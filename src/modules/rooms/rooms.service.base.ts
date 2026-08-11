import {
  BadRequestException,
  ConflictException,
  Inject,
  NotFoundException,
} from '@nestjs/common';
import { FormationsRepository } from '@lib/repositories/formations/formations.repository';
import { RoomsRepository } from '@lib/repositories/rooms/rooms.repository';
import { CreateRoomDto } from './dto/create-room.dto';
import { UpdateRoomDto } from './dto/update-room.dto';
import { FindRoomsQueryDto } from './dto/find-rooms-query.dto';

export abstract class RoomsServiceBase {
  protected readonly roomsRepository: RoomsRepository;
  protected readonly formationsRepository: FormationsRepository;

  constructor(
    @Inject(RoomsRepository) roomsRepository: RoomsRepository,
    @Inject(FormationsRepository) formationsRepository: FormationsRepository,
  ) {
    this.roomsRepository = roomsRepository;
    this.formationsRepository = formationsRepository;
  }

  async create(dto: CreateRoomDto) {
    const code = dto.code.trim().toUpperCase();
    const existing = await this.roomsRepository.findByCode(code);
    if (existing) {
      throw new ConflictException('Room code already exists');
    }
    return this.roomsRepository.create({
      code,
      name: dto.name.trim(),
      capacity: dto.capacity,
      isActive: true,
    });
  }

  async findAll(query: FindRoomsQueryDto) {
    return this.roomsRepository.findPaginated(query);
  }

  async findOne(id: string) {
    const room = await this.roomsRepository.findById(id);
    if (!room) throw new NotFoundException('Room not found');
    return room;
  }

  async update(id: string, dto: UpdateRoomDto) {
    const room = await this.roomsRepository.findById(id);
    if (!room) throw new NotFoundException('Room not found');

    if (dto.code !== undefined) {
      const code = dto.code.trim().toUpperCase();
      const other = await this.roomsRepository.findByCode(code);
      if (other && other.id !== id) {
        throw new ConflictException('Room code already exists');
      }
    }

    const patch: Parameters<RoomsRepository['update']>[1] = {
      updatedAt: new Date(),
    };
    if (dto.name !== undefined) patch.name = dto.name.trim();
    if (dto.capacity !== undefined) patch.capacity = dto.capacity;
    if (dto.isActive !== undefined) patch.isActive = dto.isActive;
    if (dto.code !== undefined) patch.code = dto.code.trim().toUpperCase();

    const updated = await this.roomsRepository.update(id, patch);
    if (!updated) throw new NotFoundException('Room not found');
    return updated;
  }

  async remove(id: string) {
    const room = await this.roomsRepository.findById(id);
    if (!room) throw new NotFoundException('Room not found');

    const n = await this.roomsRepository.countSessionsReferencingRoom(id);
    if (n > 0) {
      throw new BadRequestException(
        'Cannot delete room: sessions still reference it. Deactivate the room instead.',
      );
    }
    await this.roomsRepository.remove(id);
  }
}
