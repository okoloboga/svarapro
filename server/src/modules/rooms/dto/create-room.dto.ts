import {
  IsString,
  IsNumber,
  IsIn,
  IsOptional,
  MinLength,
} from 'class-validator';

export class CreateRoomDto {
  @IsNumber()
  minBet: number;

  @IsIn(['public', 'private'])
  type: 'public' | 'private';

  @IsOptional()
  @IsString()
  @MinLength(6)
  password?: string;
}
