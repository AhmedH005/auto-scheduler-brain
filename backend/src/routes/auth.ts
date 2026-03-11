import { Router } from 'express';
import { signup, login, refresh, logout } from '../controllers/auth.controller';
import { validate } from '../middleware/validate';
import { signupSchema, loginSchema, refreshSchema } from '../utils/validation';

export const authRouter = Router();

authRouter.post('/signup', validate(signupSchema), signup);
authRouter.post('/login', validate(loginSchema), login);
authRouter.post('/refresh', validate(refreshSchema), refresh);
authRouter.post('/logout', logout);
