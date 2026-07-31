export const authorizeRoles = (...allowedRoles) => {
    return (req, res, next) => {
        if (!req.role || !allowedRoles.includes(req.role)) {
            return res.status(403).json({
                message: `Access denied. Role '${req.role || 'unknown'}' is not authorized to access this resource.`,
                success: false
            });
        }
        next();
    };
};
