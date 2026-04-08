import { defineCollection, z } from 'astro:content';

const authors = defineCollection({
  type: 'content',
  schema: z.object({
    name: z.object({
      zh: z.string(),
      original: z.string(),
      en: z.string().optional(),
    }),
    location: z.object({
      birthplace: z.string(),
      coordinates: z.object({
        lat: z.number(),
        lng: z.number(),
      }),
      country: z.string(),
    }),
    categories: z.array(z.string()),
    era: z.string(),
    years: z.object({
      birth: z.number(),
      death: z.number().nullable(),
    }),
    portrait: z.string().default('/images/authors/default.svg'),
    color: z.string().default('#E07A5F'),
    audio: z.object({
      file: z.string(),
      quote: z.object({
        zh: z.string(),
        original: z.string().optional(),
      }),
      duration: z.number(),
    }).optional(),
    works: z.array(z.object({
      title: z.object({
        zh: z.string(),
        original: z.string().optional(),
      }),
      year: z.number().optional(),
      cover: z.string().optional(),
      description: z.string(),
    })),
    sortOrder: z.number().optional(),
    featured: z.boolean().default(false),
    draft: z.boolean().default(false),
  }),
});

export const collections = { authors };
