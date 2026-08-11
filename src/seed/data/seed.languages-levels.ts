import { eq } from 'drizzle-orm';
import { formationLevels, languages } from '@/database/schema';
import type { AcademicSeedContext } from './context';

const LANGUAGE_SEEDS = [
  { name: 'English', code: 'EN' },
  { name: 'French', code: 'FR' },
  { name: 'Spanish', code: 'ES' },
  { name: 'German', code: 'DE' },
  { name: 'Italian', code: 'IT' },
] as const;

const LEVEL_SEEDS = [
  { code: 'A1', name: 'Beginner', order: 1, description: 'Introductory level' },
  {
    code: 'A2',
    name: 'Elementary',
    order: 2,
    description: 'Elementary communication',
  },
  { code: 'B1', name: 'Intermediate', order: 3, description: 'Intermediate' },
  {
    code: 'B2',
    name: 'Upper Intermediate',
    order: 4,
    description: 'Upper intermediate',
  },
  { code: 'C1', name: 'Advanced', order: 5, description: 'Advanced' },
  { code: 'C2', name: 'Mastery', order: 6, description: 'Mastery' },
] as const;

export async function seedLanguagesAndLevels(
  ctx: AcademicSeedContext,
): Promise<void> {
  const { db } = ctx;
  for (const languageSeed of LANGUAGE_SEEDS) {
    await db
      .insert(languages)
      .values({
        name: languageSeed.name,
        code: languageSeed.code,
        isActive: true,
      })
      .onConflictDoUpdate({
        target: languages.code,
        set: { name: languageSeed.name, isActive: true },
      });
    ctx.counters.languagesUpserted += 1;
  }

  const languageRows = await db
    .select()
    .from(languages)
    .where(eq(languages.isActive, true));
  const languageByCode = new Map(languageRows.map((row) => [row.code, row]));

  for (const languageSeed of LANGUAGE_SEEDS) {
    const language = languageByCode.get(languageSeed.code);
    if (!language) continue;

    for (const levelSeed of LEVEL_SEEDS) {
      await db
        .insert(formationLevels)
        .values({
          languageId: language.id,
          code: levelSeed.code,
          name: levelSeed.name,
          order: levelSeed.order,
          description: levelSeed.description,
          isActive: true,
        })
        .onConflictDoUpdate({
          target: [formationLevels.languageId, formationLevels.code],
          set: {
            name: levelSeed.name,
            description: levelSeed.description,
            order: levelSeed.order,
            isActive: true,
          },
        });
      ctx.counters.levelsUpserted += 1;
    }
  }
}

export { LANGUAGE_SEEDS, LEVEL_SEEDS };
