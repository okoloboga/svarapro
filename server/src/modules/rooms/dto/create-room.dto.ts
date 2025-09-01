import {
  IsString,
  IsNumber,
  IsIn,
  IsOptional,
  MinLength,
  MaxLength,
  Matches,
} from 'class-validator';

export class CreateRoomDto {
  @IsNumber()
  minBet: number;

  @IsIn(['public', 'private'])
  type: 'public' | 'private';

  @IsOptional()
  @IsString()
  @MinLength(6)
  @MaxLength(6)
  @Matches(/^\d{6}$/, { message: 'Password must be exactly 6 digits' })
  password?: string;
}
