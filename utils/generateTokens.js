import jwt from "jsonwebtoken";

export const generateAccessToken = (user) => {
    return jwt.sign(
        { userId: user._id, role: user.role },
        process.env.SECRET_KEY || "defaultaccesssecret",
        { expiresIn: "15m" }
    );
};

export const generateRefreshToken = (user) => {
    return jwt.sign(
        { userId: user._id },
        process.env.REFRESH_TOKEN_SECRET || process.env.SECRET_KEY || "defaultrefreshsecret",
        { expiresIn: "7d" }
    );
};

export const setTokenCookies = (res, accessToken, refreshToken) => {
    const isProduction = process.env.NODE_ENV === "production";
    
    // 15 minutes for access token
    res.cookie("accessToken", accessToken, {
        httpOnly: true,
        secure: isProduction,
        sameSite: isProduction ? "none" : "lax",
        maxAge: 15 * 60 * 1000
    });

    // Also keep 'token' cookie for backward compatibility if needed
    res.cookie("token", accessToken, {
        httpOnly: true,
        secure: isProduction,
        sameSite: isProduction ? "none" : "lax",
        maxAge: 15 * 60 * 1000
    });

    // 7 days for refresh token
    res.cookie("refreshToken", refreshToken, {
        httpOnly: true,
        secure: isProduction,
        sameSite: isProduction ? "none" : "lax",
        maxAge: 7 * 24 * 60 * 60 * 1000
    });
};

export const clearTokenCookies = (res) => {
    const isProduction = process.env.NODE_ENV === "production";
    const cookieOptions = {
        httpOnly: true,
        secure: isProduction,
        sameSite: isProduction ? "none" : "lax",
        maxAge: 0
    };

    res.cookie("accessToken", "", cookieOptions);
    res.cookie("token", "", cookieOptions);
    res.cookie("refreshToken", "", cookieOptions);
};
