import express from "express";
import {
    login,
    logout,
    register,
    updateProfile,
    refreshTokenController,
    googleAuth,
    phoneAuth,
    sendOtp,
    selectRole,
    onboardUser
} from "../controllers/user.controller.js";
import isAuthenticated from "../middlewares/isAuthenticated.js";
import { singleUpload } from "../middlewares/mutler.js";
 
const router = express.Router();

router.route("/register").post(singleUpload, register);
router.route("/login").post(login);
router.route("/logout").get(logout);
router.route("/refresh-token").post(refreshTokenController);

// New Auth & Onboarding Routes
router.route("/google-auth").post(googleAuth);
router.route("/phone-auth").post(phoneAuth);
router.route("/send-otp").post(sendOtp);
router.route("/select-role").post(isAuthenticated, selectRole);
router.route("/onboard").post(isAuthenticated, singleUpload, onboardUser);

router.route("/profile/update").post(isAuthenticated, singleUpload, updateProfile);

export default router;
