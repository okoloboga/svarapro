import { Controller, Get, UseGuards, Request, UnauthorizedException } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { UsersService } from './users.service';

@Controller('users')
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @UseGuards(JwtAuthGuard)
  @Get('profile')
  async getProfile(@Request() req) {
    return this.usersService.getProfile(req.user.telegramId);
  }

  @UseGuards(JwtAuthGuard)
  @Get('referrals')
  async getReferrals(@Request() req) {
    return this.usersService.getReferrals(req.user.telegramId);
  }

  @UseGuards(JwtAuthGuard)
  @Get('referral-link')
  async getReferralLink(@Request() req) {
    const telegramId = req.user.telegramId;
    if (!telegramId) throw new UnauthorizedException('Telegram ID is missing');
    return this.usersService.getReferralData(telegramId);
  }
}
