import { Injectable, Inject } from '@nestjs/common';
import { and, eq } from 'drizzle-orm';
import { DRIZZLE_DB, DrizzleDB } from '@/database/database.module';
import { users, NewUser, User } from '@/database/schema';

@Injectable()
export class UsersRepository {
  constructor(@Inject(DRIZZLE_DB) private readonly db: DrizzleDB) {}

  async findAll(): Promise<User[]> {
    return this.db.select().from(users);
  }

  async findById(id: string): Promise<User | undefined> {
    const result = await this.db
      .select()
      .from(users)
      .where(eq(users.id, id))
      .limit(1);
    return result[0];
  }

  async findByMatriculeAndYear(
    bacYear: number,
    matricule: string,
  ): Promise<User | undefined> {
    const result = await this.db
      .select()
      .from(users)
      .where(and(eq(users.bacYear, bacYear), eq(users.matricule, matricule)))
      .limit(1);
    return result[0];
  }

  async findByEmail(email: string): Promise<User | undefined> {
    const result = await this.db
      .select()
      .from(users)
      .where(eq(users.email, email))
      .limit(1);
    return result[0];
  }

  async create(data: NewUser): Promise<User> {
    const result = await this.db.insert(users).values(data).returning();
    return result[0];
  }

  async update(id: string, data: Partial<NewUser>): Promise<User | undefined> {
    const result = await this.db
      .update(users)
      .set(data)
      .where(eq(users.id, id))
      .returning();
    return result[0];
  }

  async delete(id: string): Promise<void> {
    await this.db.delete(users).where(eq(users.id, id));
  }
}
