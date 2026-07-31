import { User } from "../models/user.model.js";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import getDataUri from "../utils/datauri.js";
import cloudinary from "../utils/cloudinary.js";
import { generateAccessToken, generateRefreshToken, setTokenCookies, clearTokenCookies } from "../utils/generateTokens.js";

export const register = async (req, res) => {
    try {
        const { fullname, email, phoneNumber, password, role } = req.body;
         
        if (!fullname || !email || !phoneNumber || !password || !role) {
            return res.status(400).json({
                message: "Something is missing",
                success: false
            });
        }

        let profilePhotoUrl = "";
        if (req.file) {
            const fileUri = getDataUri(req.file);
            const cloudResponse = await cloudinary.uploader.upload(fileUri.content, {
                resource_type: "raw"
            });
            profilePhotoUrl = cloudResponse.secure_url;
        }

        const existingUser = await User.findOne({ email });
        if (existingUser) {
            return res.status(400).json({
                message: "User already exists with this email.",
                success: false,
            });
        }
        const hashedPassword = await bcrypt.hash(password, 10);

        await User.create({
            fullname,
            email,
            phoneNumber,
            password: hashedPassword,
            role,
            profile: {
                profilePhoto: profilePhotoUrl,
            }
        });

        return res.status(201).json({
            message: "Account created successfully.",
            success: true
        });
    } catch (error) {
        console.log(error);
        return res.status(500).json({
            message: "Internal server error.",
            success: false
        });
    }
};

export const login = async (req, res) => {
    try {
        const { email, password, role } = req.body;
        
        if (!email || !password || !role) {
            return res.status(400).json({
                message: "Something is missing",
                success: false
            });
        }
        let userDoc = await User.findOne({ email });
        if (!userDoc) {
            return res.status(400).json({
                message: "Incorrect email or password.",
                success: false,
            });
        }
        const isPasswordMatch = await bcrypt.compare(password, userDoc.password);
        if (!isPasswordMatch) {
            return res.status(400).json({
                message: "Incorrect email or password.",
                success: false,
            });
        }
        // check role is correct or not
        if (role !== userDoc.role) {
            return res.status(400).json({
                message: "Account doesn't exist with current role.",
                success: false
            });
        }

        // Generate tokens
        const accessToken = generateAccessToken(userDoc);
        const refreshToken = generateRefreshToken(userDoc);

        // Save refresh token in DB
        userDoc.refreshToken = refreshToken;
        await userDoc.save();

        // Set cookies
        setTokenCookies(res, accessToken, refreshToken);

        const userData = {
            _id: userDoc._id,
            fullname: userDoc.fullname,
            email: userDoc.email,
            phoneNumber: userDoc.phoneNumber,
            role: userDoc.role,
            profile: userDoc.profile
        };

        return res.status(200).json({
            message: `Welcome back ${userData.fullname}`,
            user: userData,
            success: true
        });
    } catch (error) {
        console.log(error);
        return res.status(500).json({
            message: "Internal server error during login.",
            success: false
        });
    }
};

export const logout = async (req, res) => {
    try {
        const refreshToken = req.cookies.refreshToken;
        if (refreshToken) {
            const user = await User.findOne({ refreshToken });
            if (user) {
                user.refreshToken = "";
                await user.save();
            }
        }

        clearTokenCookies(res);

        return res.status(200).json({
            message: "Logged out successfully.",
            success: true
        });
    } catch (error) {
        console.log(error);
        return res.status(500).json({
            message: "Error during logout.",
            success: false
        });
    }
};

export const refreshTokenController = async (req, res) => {
    try {
        const refreshToken = req.cookies.refreshToken;

        if (!refreshToken) {
            return res.status(401).json({
                message: "Refresh token missing. Please log in again.",
                success: false
            });
        }

        const decoded = jwt.verify(
            refreshToken,
            process.env.REFRESH_TOKEN_SECRET || process.env.SECRET_KEY || "defaultrefreshsecret"
        );

        const user = await User.findById(decoded.userId);
        if (!user || user.refreshToken !== refreshToken) {
            clearTokenCookies(res);
            return res.status(403).json({
                message: "Invalid or expired refresh token.",
                success: false
            });
        }

        const newAccessToken = generateAccessToken(user);
        const newRefreshToken = generateRefreshToken(user);

        user.refreshToken = newRefreshToken;
        await user.save();

        setTokenCookies(res, newAccessToken, newRefreshToken);

        return res.status(200).json({
            message: "Token refreshed successfully.",
            success: true
        });
    } catch (error) {
        console.log("Refresh token error:", error.message);
        clearTokenCookies(res);
        return res.status(403).json({
            message: "Session expired. Please log in again.",
            success: false
        });
    }
};

export const updateProfile = async (req, res) => {
    try {
        const { fullname, email, phoneNumber, bio, skills } = req.body;
        
        let cloudResponse;
        if (req.file) {
            const fileUri = getDataUri(req.file);
            cloudResponse = await cloudinary.uploader.upload(fileUri.content, {
                resource_type: "raw"
            });
        }

        let skillsArray;
        if (skills) {
            skillsArray = skills.split(",");
        }
        const userId = req.id; // middleware authentication
        let user = await User.findById(userId);

        if (!user) {
            return res.status(400).json({
                message: "User not found.",
                success: false
            });
        }

        // updating data
        if (fullname) user.fullname = fullname;
        if (email) user.email = email;
        if (phoneNumber) user.phoneNumber = phoneNumber;
        if (bio) user.profile.bio = bio;
        if (skills) user.profile.skills = skillsArray;
      
        if (cloudResponse) {
            user.profile.resume = cloudResponse.secure_url; // save the cloudinary url
            user.profile.resumeOriginalName = req.file.originalname; // Save original file name
        }

        await user.save();

        const userData = {
            _id: user._id,
            fullname: user.fullname,
            email: user.email,
            phoneNumber: user.phoneNumber,
            role: user.role,
            profile: user.profile
        };

        return res.status(200).json({
            message: "Profile updated successfully.",
            user: userData,
            success: true
        });
    } catch (error) {
        console.log(error);
        return res.status(500).json({
            message: "Error updating profile.",
            success: false
        });
    }
};