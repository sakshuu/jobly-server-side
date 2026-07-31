import express from "express";
import { login, logout, register, updateProfile, refreshTokenController } from "../controllers/user.controller.js";
import isAuthenticated from "../middlewares/isAuthenticated.js";
import { singleUpload } from "../middlewares/mutler.js";
 
const router = express.Router();

router.route("/register").post(singleUpload, register);
router.route("/login").post(login);
router.route("/logout").get(logout);
router.route("/refresh-token").post(refreshTokenController);
router.route("/profile/update").post(isAuthenticated, singleUpload, updateProfile);

export default router;
