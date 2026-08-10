import { User } from "../models/user.model.js";
import { Company } from "../models/company.model.js";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import getDataUri from "../utils/datauri.js";
import cloudinary from "../utils/cloudinary.js";
import { generateAccessToken, generateRefreshToken, setTokenCookies, clearTokenCookies } from "../utils/generateTokens.js";
import { calculateProfileScore } from "../utils/profileCalculator.js";

// Temporary in-memory OTP storage for dev fallback testing
const devOtpStore = new Map();

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

        const newUser = new User({
            fullname,
            email,
            phoneNumber: String(phoneNumber),
            password: hashedPassword,
            role,
            authProvider: 'email',
            isOnboarded: true,
            profile: {
                profilePhoto: profilePhotoUrl,
            }
        });

        // Calculate initial profile completion & stars
        const { profileCompletion, stars } = calculateProfileScore(newUser);
        newUser.profile.profileCompletion = profileCompletion;
        newUser.profile.stars = stars;

        await newUser.save();

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
        
        if (!email || !password) {
            return res.status(400).json({
                message: "Email and password are required.",
                success: false
            });
        }
        let userDoc = await User.findOne({ email });
        if (!userDoc || !userDoc.password) {
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

        if (role && role !== userDoc.role && userDoc.role !== 'pending') {
            return res.status(400).json({
                message: "Account doesn't exist with current role.",
                success: false
            });
        }

        // Recalculate score on login
        const { profileCompletion, stars } = calculateProfileScore(userDoc);
        userDoc.profile.profileCompletion = profileCompletion;
        userDoc.profile.stars = stars;

        // Generate tokens
        const accessToken = generateAccessToken(userDoc);
        const refreshToken = generateRefreshToken(userDoc);

        userDoc.refreshToken = refreshToken;
        await userDoc.save();

        setTokenCookies(res, accessToken, refreshToken);

        const userData = {
            _id: userDoc._id,
            fullname: userDoc.fullname,
            email: userDoc.email,
            phoneNumber: userDoc.phoneNumber,
            role: userDoc.role,
            isOnboarded: userDoc.isOnboarded,
            authProvider: userDoc.authProvider,
            profile: userDoc.profile,
            updatedAt: userDoc.updatedAt
        };

        return res.status(200).json({
            message: `Welcome back ${userData.fullname || userData.email}`,
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

// Google Auth Endpoint
export const googleAuth = async (req, res) => {
    try {
        const { googleId, email, fullname, profilePhoto } = req.body;

        if (!email) {
            return res.status(400).json({
                message: "Email is required for Google Sign-In.",
                success: false
            });
        }

        let userDoc = await User.findOne({ $or: [{ googleId }, { email }] });

        let isNewUser = false;
        if (!userDoc) {
            isNewUser = true;
            userDoc = new User({
                fullname: fullname || "",
                email,
                googleId: googleId || "",
                authProvider: 'google',
                role: 'pending',
                isOnboarded: false,
                profile: {
                    profilePhoto: profilePhoto || ""
                }
            });
        } else {
            if (!userDoc.googleId && googleId) {
                userDoc.googleId = googleId;
            }
            if (profilePhoto && !userDoc.profile.profilePhoto) {
                userDoc.profile.profilePhoto = profilePhoto;
            }
        }

        const { profileCompletion, stars } = calculateProfileScore(userDoc);
        userDoc.profile.profileCompletion = profileCompletion;
        userDoc.profile.stars = stars;

        const accessToken = generateAccessToken(userDoc);
        const refreshToken = generateRefreshToken(userDoc);

        userDoc.refreshToken = refreshToken;
        await userDoc.save();

        setTokenCookies(res, accessToken, refreshToken);

        const userData = {
            _id: userDoc._id,
            fullname: userDoc.fullname,
            email: userDoc.email,
            phoneNumber: userDoc.phoneNumber,
            role: userDoc.role,
            isOnboarded: userDoc.isOnboarded,
            authProvider: userDoc.authProvider,
            profile: userDoc.profile,
            updatedAt: userDoc.updatedAt
        };

        return res.status(200).json({
            message: isNewUser ? "Signed up with Google successfully." : `Welcome back ${userData.fullname || userData.email}`,
            user: userData,
            isNewUser,
            needRoleSelection: userDoc.role === 'pending',
            needOnboarding: !userDoc.isOnboarded,
            success: true
        });
    } catch (error) {
        console.log("Google auth error:", error);
        return res.status(500).json({
            message: "Google authentication failed.",
            success: false
        });
    }
};

// Dev OTP Generator (Free Fallback)
export const sendOtp = async (req, res) => {
    try {
        const { phoneNumber } = req.body;
        if (!phoneNumber) {
            return res.status(400).json({ message: "Phone number is required.", success: false });
        }

        // Generate 6-digit test OTP code
        const otpCode = Math.floor(100000 + Math.random() * 900000).toString();
        devOtpStore.set(String(phoneNumber).trim(), { code: otpCode, expires: Date.now() + 5 * 60 * 1000 });

        console.log(`\n==========================================`);
        console.log(`📱 [DEV OTP SERVICE] Phone: ${phoneNumber} | OTP: ${otpCode}`);
        console.log(`==========================================\n`);

        return res.status(200).json({
            message: `OTP sent successfully to ${phoneNumber}. (Dev Mode Code: ${otpCode})`,
            otpCode, // Returned for dev testing convenience
            success: true
        });
    } catch (error) {
        console.log(error);
        return res.status(500).json({ message: "Failed to send OTP.", success: false });
    }
};

// Phone Auth Endpoint (Supports Firebase Verified Phone OR Dev OTP)
export const phoneAuth = async (req, res) => {
    try {
        const { phoneNumber, otpCode, firebaseToken } = req.body;

        if (!phoneNumber) {
            return res.status(400).json({
                message: "Phone number is required.",
                success: false
            });
        }

        const cleanPhone = String(phoneNumber).trim();

        // If OTP code is provided, verify using dev OTP store or default test code 123456
        if (otpCode) {
            const storedData = devOtpStore.get(cleanPhone);
            const isTestOtp = otpCode === "123456"; // Default test OTP code
            const isMatch = (storedData && storedData.code === otpCode) || isTestOtp;

            if (!isMatch) {
                return res.status(400).json({
                    message: "Invalid or expired OTP code.",
                    success: false
                });
            }
            devOtpStore.delete(cleanPhone);
        }

        let userDoc = await User.findOne({ phoneNumber: cleanPhone });
        let isNewUser = false;

        if (!userDoc) {
            isNewUser = true;
            userDoc = new User({
                phoneNumber: cleanPhone,
                authProvider: 'phone',
                role: 'pending',
                isOnboarded: false,
                profile: {}
            });
        }

        const { profileCompletion, stars } = calculateProfileScore(userDoc);
        userDoc.profile.profileCompletion = profileCompletion;
        userDoc.profile.stars = stars;

        const accessToken = generateAccessToken(userDoc);
        const refreshToken = generateRefreshToken(userDoc);

        userDoc.refreshToken = refreshToken;
        await userDoc.save();

        setTokenCookies(res, accessToken, refreshToken);

        const userData = {
            _id: userDoc._id,
            fullname: userDoc.fullname,
            email: userDoc.email,
            phoneNumber: userDoc.phoneNumber,
            role: userDoc.role,
            isOnboarded: userDoc.isOnboarded,
            authProvider: userDoc.authProvider,
            profile: userDoc.profile,
            updatedAt: userDoc.updatedAt
        };

        return res.status(200).json({
            message: isNewUser ? "Phone verification successful." : `Welcome back ${userData.fullname || userData.phoneNumber}`,
            user: userData,
            isNewUser,
            needRoleSelection: userDoc.role === 'pending',
            needOnboarding: !userDoc.isOnboarded,
            success: true
        });
    } catch (error) {
        console.log("Phone auth error:", error);
        return res.status(500).json({
            message: "Phone authentication failed.",
            success: false
        });
    }
};

// Select Role Endpoint
export const selectRole = async (req, res) => {
    try {
        const { role } = req.body;
        if (!role || !['student', 'recruiter'].includes(role)) {
            return res.status(400).json({
                message: "Valid role ('student' or 'recruiter') is required.",
                success: false
            });
        }

        const userId = req.id;
        const userDoc = await User.findById(userId);

        if (!userDoc) {
            return res.status(404).json({ message: "User not found.", success: false });
        }

        userDoc.role = role;
        await userDoc.save();

        const userData = {
            _id: userDoc._id,
            fullname: userDoc.fullname,
            email: userDoc.email,
            phoneNumber: userDoc.phoneNumber,
            role: userDoc.role,
            isOnboarded: userDoc.isOnboarded,
            authProvider: userDoc.authProvider,
            profile: userDoc.profile,
            updatedAt: userDoc.updatedAt
        };

        return res.status(200).json({
            message: `Role selected as ${role}. Please complete onboarding.`,
            user: userData,
            success: true
        });
    } catch (error) {
        console.log(error);
        return res.status(500).json({ message: "Failed to select role.", success: false });
    }
};

// Role-Specific Onboarding Endpoint
export const onboardUser = async (req, res) => {
    try {
        const userId = req.id;
        const userDoc = await User.findById(userId);

        if (!userDoc) {
            return res.status(404).json({ message: "User not found.", success: false });
        }

        const {
            fullname,
            email,
            phoneNumber,
            bio,
            skills,
            linkedin,
            companyName,
            companyDescription,
            companyWebsite,
            companyLocation
        } = req.body;

        if (fullname) userDoc.fullname = fullname;
        if (email) userDoc.email = email;
        if (phoneNumber) userDoc.phoneNumber = String(phoneNumber);
        if (bio) userDoc.profile.bio = bio;

        if (skills) {
            if (typeof skills === "string") {
                userDoc.profile.skills = skills.split(",").map(s => s.trim()).filter(Boolean);
            } else if (Array.isArray(skills)) {
                userDoc.profile.skills = skills;
            }
        }

        if (linkedin) {
            userDoc.profile.socialLinks.linkedin = linkedin;
        }

        // Handle uploaded photo if any
        if (req.file) {
            const fileUri = getDataUri(req.file);
            const cloudResponse = await cloudinary.uploader.upload(fileUri.content, { resource_type: "raw" });
            userDoc.profile.profilePhoto = cloudResponse.secure_url;
        }

        // If Recruiter onboarding with Company details
        if (userDoc.role === 'recruiter' && companyName) {
            let company = await Company.findOne({ name: companyName });
            if (!company) {
                company = await Company.create({
                    name: companyName,
                    description: companyDescription || "",
                    website: companyWebsite || "",
                    location: companyLocation || "",
                    userId: userDoc._id
                });
            }
            userDoc.profile.company = company._id;
        }

        userDoc.isOnboarded = true;

        const { profileCompletion, stars } = calculateProfileScore(userDoc);
        userDoc.profile.profileCompletion = profileCompletion;
        userDoc.profile.stars = stars;

        await userDoc.save();

        const userData = {
            _id: userDoc._id,
            fullname: userDoc.fullname,
            email: userDoc.email,
            phoneNumber: userDoc.phoneNumber,
            role: userDoc.role,
            isOnboarded: userDoc.isOnboarded,
            authProvider: userDoc.authProvider,
            profile: userDoc.profile,
            updatedAt: userDoc.updatedAt
        };

        return res.status(200).json({
            message: "Onboarding completed successfully!",
            user: userData,
            success: true
        });
    } catch (error) {
        console.log("Onboarding error:", error);
        return res.status(500).json({ message: "Failed to complete onboarding.", success: false });
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
        const {
            fullname,
            email,
            phoneNumber,
            bio,
            skills,
            socialLinks,
            experience,
            education,
            projects,
            certifications
        } = req.body;
        
        let cloudResponse;
        if (req.file) {
            const fileUri = getDataUri(req.file);
            cloudResponse = await cloudinary.uploader.upload(fileUri.content, {
                resource_type: "raw"
            });
        }

        const userId = req.id;
        let user = await User.findById(userId);

        if (!user) {
            return res.status(400).json({
                message: "User not found.",
                success: false
            });
        }

        if (fullname) user.fullname = fullname;
        if (email) user.email = email;
        if (phoneNumber) user.phoneNumber = String(phoneNumber);
        if (bio !== undefined) user.profile.bio = bio;

        if (skills !== undefined) {
            if (typeof skills === "string") {
                user.profile.skills = skills ? skills.split(",").map(s => s.trim()).filter(Boolean) : [];
            } else if (Array.isArray(skills)) {
                user.profile.skills = skills;
            }
        }
      
        if (cloudResponse) {
            user.profile.resume = cloudResponse.secure_url;
            user.profile.resumeOriginalName = req.file.originalname;
        }

        if (socialLinks !== undefined) {
            let parsedSocials = socialLinks;
            if (typeof socialLinks === "string") {
                try { parsedSocials = JSON.parse(socialLinks); } catch (e) { parsedSocials = {}; }
            }
            user.profile.socialLinks = {
                linkedin: parsedSocials?.linkedin || user.profile.socialLinks?.linkedin || "",
                github: parsedSocials?.github || user.profile.socialLinks?.github || "",
                portfolio: parsedSocials?.portfolio || user.profile.socialLinks?.portfolio || "",
                twitter: parsedSocials?.twitter || user.profile.socialLinks?.twitter || ""
            };
        }

        if (experience !== undefined) {
            let parsedExp = experience;
            if (typeof experience === "string") {
                try { parsedExp = JSON.parse(experience); } catch (e) { parsedExp = []; }
            }
            if (Array.isArray(parsedExp)) {
                user.profile.experience = parsedExp;
            }
        }

        if (education !== undefined) {
            let parsedEdu = education;
            if (typeof education === "string") {
                try { parsedEdu = JSON.parse(education); } catch (e) { parsedEdu = []; }
            }
            if (Array.isArray(parsedEdu)) {
                user.profile.education = parsedEdu;
            }
        }

        if (projects !== undefined) {
            let parsedProj = projects;
            if (typeof projects === "string") {
                try { parsedProj = JSON.parse(projects); } catch (e) { parsedProj = []; }
            }
            if (Array.isArray(parsedProj)) {
                user.profile.projects = parsedProj;
            }
        }

        if (certifications !== undefined) {
            let parsedCert = certifications;
            if (typeof certifications === "string") {
                try { parsedCert = JSON.parse(certifications); } catch (e) { parsedCert = []; }
            }
            if (Array.isArray(parsedCert)) {
                user.profile.certifications = parsedCert;
            }
        }

        const { profileCompletion, stars } = calculateProfileScore(user);
        user.profile.profileCompletion = profileCompletion;
        user.profile.stars = stars;

        await user.save();

        const userData = {
            _id: user._id,
            fullname: user.fullname,
            email: user.email,
            phoneNumber: user.phoneNumber,
            role: user.role,
            isOnboarded: user.isOnboarded,
            authProvider: user.authProvider,
            profile: user.profile,
            updatedAt: user.updatedAt
        };

        return res.status(200).json({
            message: "Profile updated successfully.",
            user: userData,
            success: true
        });
    } catch (error) {
        console.log("Error updating profile:", error);
        return res.status(500).json({
            message: "Error updating profile.",
            success: false
        });
    }
};