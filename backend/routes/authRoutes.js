const express = require('express');
const router = express.Router();
const { 
    registerUserController, 
    loginUserController, 
    logoutUserController, 
    getMeController 
} = require('../controllers/authController');
const { authUser } = require('../middlewares/authMiddleware');

// @route   POST /api/auth/register
// @desc    Register a new user
// @access  Public
router.post('/register', registerUserController);

// @route   POST /api/auth/login
// @desc    Authenticate user & get token
// @access  Public
router.post('/login', loginUserController);

// @route   POST /api/auth/logout
// @desc    Logout user & clear cookie
// @access  Public
router.post('/logout', logoutUserController);

// @route   GET /api/auth/me
// @desc    Get current user details
// @access  Private
router.get('/me', authUser, getMeController);

module.exports = router;