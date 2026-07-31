export const calculateProfileScore = (user) => {
    if (!user) return { profileCompletion: 0, stars: 1 };

    const profile = user.profile || {};
    let score = 0;

    // 1. Basic details (Bio & Photo) - 20%
    if (profile.bio && profile.bio.trim().length > 0) score += 10;
    if (profile.profilePhoto && profile.profilePhoto.trim().length > 0) score += 10;

    // 2. Skills - 15%
    if (Array.isArray(profile.skills) && profile.skills.length > 0) score += 15;

    // 3. Resume Upload - 15%
    if (profile.resume && profile.resume.trim().length > 0) score += 15;

    // 4. LinkedIn Link (Mandatory Social Link) - 15%
    if (profile.socialLinks && profile.socialLinks.linkedin && profile.socialLinks.linkedin.trim().length > 0) {
        score += 15;
    }

    // 5. Professional Experience - 15%
    if (Array.isArray(profile.experience) && profile.experience.length > 0) score += 15;

    // 6. Education - 10%
    if (Array.isArray(profile.education) && profile.education.length > 0) score += 10;

    // 7. Projects or Certifications - 10%
    const hasProjects = Array.isArray(profile.projects) && profile.projects.length > 0;
    const hasCertifications = Array.isArray(profile.certifications) && profile.certifications.length > 0;
    if (hasProjects || hasCertifications) score += 10;

    // Ensure score capped between 0 and 100
    const profileCompletion = Math.min(100, Math.max(0, score));

    // Calculate stars
    let stars = 1;
    if (profileCompletion >= 95) {
        stars = 5;
    } else if (profileCompletion >= 85) {
        stars = 4;
    } else if (profileCompletion >= 70) {
        stars = 3;
    } else if (profileCompletion >= 50) {
        stars = 2;
    } else {
        stars = 1;
    }

    return { profileCompletion, stars };
};
