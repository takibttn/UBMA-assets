import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiBody,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { Auth } from '@lib/decorators/auth.decorator';
import { UserRole } from '@modules/auth/types/user-role.type';
import { RoomsService } from './rooms.service';
import { CreateRoomDto } from './dto/create-room.dto';
import { UpdateRoomDto } from './dto/update-room.dto';
import { FindRoomsQueryDto } from './dto/find-rooms-query.dto';
import { RoomAvailabilityForWeeklySlotDto } from './dto/room-availability-for-weekly-slot.dto';
import { RoomAvailabilityRequestDto } from './dto/room-availability-request.dto';
import { RoomAvailabilityResponseDto } from './dto/room-availability-shared.dto';

@ApiTags('rooms')
@Controller('rooms')
@Auth(UserRole.ADMIN)
@ApiBearerAuth()
export class RoomsController {
  constructor(private readonly roomsService: RoomsService) {}

  @Post('availability')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary:
      'Room availability for an exact session interval (ADMIN UX — create / edit séance)',
    description:
      'UX helper only. Session CRUD and generate still enforce schedule conflicts (409). Ignores CANCELLED sessions.',
  })
  @ApiBody({ type: RoomAvailabilityRequestDto })
  @ApiResponse({
    status: 200,
    type: RoomAvailabilityResponseDto,
  })
  @ApiResponse({
    status: 400,
    description: 'Invalid body or outside formation period',
  })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 403, description: 'Forbidden' })
  @ApiResponse({ status: 404, description: 'Formation not found' })
  availabilityExact(@Body() dto: RoomAvailabilityRequestDto) {
    return this.roomsService.getAvailabilityForExactInterval(dto);
  }

  @Post('availability-for-weekly-slot')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary:
      'Room availability for a weekly slot over a formation period (ADMIN UX helper)',
    description:
      'Does not replace POST .../sessions/preview or generate — no teacher conflicts. Ignores CANCELLED sessions.',
  })
  @ApiBody({ type: RoomAvailabilityForWeeklySlotDto })
  @ApiResponse({
    status: 200,
    type: RoomAvailabilityResponseDto,
  })
  @ApiResponse({ status: 400, description: 'Invalid body or formation period' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 403, description: 'Forbidden' })
  @ApiResponse({ status: 404, description: 'Formation not found' })
  availabilityForWeeklySlot(@Body() dto: RoomAvailabilityForWeeklySlotDto) {
    return this.roomsService.getAvailabilityForWeeklySlot(dto);
  }

  @Post()
  @ApiOperation({ summary: 'Create room (ADMIN)' })
  @ApiResponse({ status: 201 })
  create(@Body() dto: CreateRoomDto) {
    return this.roomsService.create(dto);
  }

  @Get()
  @ApiOperation({ summary: 'List rooms (ADMIN)' })
  findAll(@Query() query: FindRoomsQueryDto) {
    return this.roomsService.findAll(query);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get room by id (ADMIN)' })
  findOne(@Param('id', ParseUUIDPipe) id: string) {
    return this.roomsService.findOne(id);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Update room (ADMIN)' })
  update(@Param('id', ParseUUIDPipe) id: string, @Body() dto: UpdateRoomDto) {
    return this.roomsService.update(id, dto);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Delete room if unused (ADMIN)' })
  @ApiResponse({ status: 204 })
  remove(@Param('id', ParseUUIDPipe) id: string) {
    return this.roomsService.remove(id);
  }
}
