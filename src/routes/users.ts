import express, { Router } from 'express';
import { authMiddleware } from '../middleware/auth';
import { db } from '$db/db';