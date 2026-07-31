import mongoose from "mongoose";

const userSchema = new mongoose.Schema({
    fullname: {
        type: String,
        required: true
    },
    email: {
        type: String,
        required: true,
        unique: true
    },
    phoneNumber: {
        type: Number,
        required: true
    },
    password:{
        type: String,
        required: true,
    },
    role:{
        type: String,
        enum: ['student', 'recruiter'],
        required: true
    },
    profile:{
        bio: { type: String, default: "" },
        skills: [{ type: String }],
        resume: { type: String, default: "" }, // URL to resume file
        resumeOriginalName: { type: String, default: "" },
        company: { type: mongoose.Schema.Types.ObjectId, ref: 'Company' }, 
        profilePhoto: {
            type: String,
            default: ""
        },
        socialLinks: {
            linkedin: { type: String, default: "" },
            github: { type: String, default: "" },
            portfolio: { type: String, default: "" },
            twitter: { type: String, default: "" }
        },
        experience: [
            {
                title: String,
                company: String,
                location: String,
                startDate: String,
                endDate: String,
                description: String
            }
        ],
        education: [
            {
                degree: String,
                institution: String,
                fieldOfStudy: String,
                startYear: String,
                endYear: String,
                grade: String
            }
        ],
        projects: [
            {
                title: String,
                description: String,
                link: String,
                technologies: String
            }
        ],
        certifications: [
            {
                title: String,
                issuer: String,
                year: String,
                link: String
            }
        ],
        profileCompletion: {
            type: Number,
            default: 0
        },
        stars: {
            type: Number,
            default: 1
        }
    },
    refreshToken:{
        type: String,
        default: ""
    }
},{timestamps:true});

export const User = mongoose.model('User', userSchema);