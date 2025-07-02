import { Body, Controller, Post, BadRequestException } from '@nestjs/common'
import { AuthService } from './auth.service'
import { LoginDto } from './dto/login.dto'

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('login')
  async login(@Body() { initData }: LoginDto) {
    if (!initData.includes('hash=')) {
      throw new BadRequestException('Invalid initData format');
    }
    return this.authService.login(initData);
  }
}
