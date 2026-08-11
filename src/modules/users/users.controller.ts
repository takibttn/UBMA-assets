import { Body, Controller, Post, UseGuards } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { UsersService } from './users.service';
import { CreateUserDto } from './dto/create-user.dto';
import { DevOnlyGuard } from '@lib/guards/dev-only.guard';

@ApiTags('users')
@Controller('users')
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Post()
  @UseGuards(DevOnlyGuard)
  @ApiOperation({ summary: '[DEV ONLY] Create a user' })
  create(@Body() dto: CreateUserDto) {
    return this.usersService.create(dto);
  }
}
