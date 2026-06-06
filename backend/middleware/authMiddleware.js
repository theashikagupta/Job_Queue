const jwt = require('jsonwebtoken');
const User = require('../User');

async function protect(req, res, next) {
  try {
    const authHeader = req.headers.authorization || '';
    const [scheme, token] = authHeader.split(' ');

    if (scheme !== 'Bearer' || !token) {
      return res.status(401).json({
        success: false,
        message: 'Unauthorized: token missing',
      });
    }

    if (!process.env.JWT_SECRET) {
      return res.status(500).json({
        success: false,
        message: 'JWT_SECRET environment variable is required.',
      });
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const user = await User.findById(decoded.userId).select('-password').lean();

    if (!user) {
      return res.status(401).json({
        success: false,
        message: 'Unauthorized: token invalid or expired',
      });
    }

    req.user = user;
    return next();
  } catch (_error) {
    return res.status(401).json({
      success: false,
      message: 'Unauthorized: token invalid or expired',
    });
  }
}

module.exports = protect;
