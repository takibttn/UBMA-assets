import { Controller } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { CalendarService } from './calendar.service';

@ApiTags('calendar')
@Controller('calendar')
export class CalendarController {
  constructor(private readonly calendarService: CalendarService) {}
}
