import {
  ValidationArguments,
  ValidatorConstraint,
  ValidatorConstraintInterface,
} from 'class-validator';
import { tryParseTeacherCalendarBoundary } from '../utils/teacher-calendar-query.util';

/**
 * Validates optional `from` / `to` ISO strings and ensures from <= to when both set.
 * Place on a field that is always "visited" — we use `search` so empty queries still run this check.
 */
@ValidatorConstraint({ name: 'teacherCalendarDateRange', async: false })
export class TeacherCalendarDateRangeConstraint implements ValidatorConstraintInterface {
  validate(_value: unknown, args: ValidationArguments): boolean {
    const o = args.object as { from?: string; to?: string };
    const fromRaw = o.from?.trim();
    const toRaw = o.to?.trim();

    if (fromRaw) {
      if (!tryParseTeacherCalendarBoundary(fromRaw, false)) return false;
    }
    if (toRaw) {
      if (!tryParseTeacherCalendarBoundary(toRaw, true)) return false;
    }
    if (fromRaw && toRaw) {
      const fromTs = tryParseTeacherCalendarBoundary(fromRaw, false)!;
      const toTs = tryParseTeacherCalendarBoundary(toRaw, true)!;
      if (fromTs.getTime() > toTs.getTime()) return false;
    }
    return true;
  }

  defaultMessage(): string {
    return 'from and to must be valid ISO 8601 date/datetime strings; if both are set, from <= to';
  }
}
