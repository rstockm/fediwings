import { z } from 'zod';

export const accountSchema = z.object({
  id: z.string(),
  username: z.string(),
  acct: z.string(),
  display_name: z.string().default(''),
  url: z.string(),
  uri: z.string().optional(),
  avatar_static: z.string(),
  followers_count: z.number().int().nonnegative(),
  hide_collections: z.boolean().nullable().optional(),
});

export const accountListSchema = z.array(accountSchema);

export const mediaAttachmentSchema = z.object({
  type: z.string(),
  url: z.string(),
  preview_url: z
    .string()
    .nullable()
    .optional()
    .transform((value) => value ?? null),
  description: z.string().nullable().optional(),
});

// Friendica mappt in der Mastodon-kompatiblen API den Beitragstitel auf
// spoiler_text; die ContentWarning dient nur als Fallback
// (Status.php: spoiler_text = title ?: content-warning ?: '').
// Ein vorhandener Titel ist daher eine Überschrift und keine ContentWarning.
const statusObjectSchema = z.object({
  id: z.string(),
  created_at: z.string(),
  url: z.string().nullable(),
  content: z.string(),
  spoiler_text: z.string().default(''),
  sensitive: z.boolean().default(false),
  visibility: z.string(),
  favourites_count: z.number().int().nonnegative(),
  reblogs_count: z.number().int().nonnegative(),
  replies_count: z.number().int().nonnegative(),
  quotes_count: z.number().int().nonnegative().optional(),
  in_reply_to_id: z.string().nullable().default(null),
  in_reply_to_account_id: z.string().nullable().default(null),
  media_attachments: z.array(mediaAttachmentSchema).default([]),
  friendica: z
    .object({
      title: z.string().nullish(),
    })
    .nullish(),
});

function stripFriendicaTitleSpoiler<
  T extends { spoiler_text: string; friendica?: { title?: string | null } | null },
>(status: T): Omit<T, 'friendica'> {
  const { friendica, ...rest } = status;
  if (friendica?.title) {
    return { ...rest, spoiler_text: '' };
  }
  return rest;
}

export const statusSchema = statusObjectSchema.transform(stripFriendicaTitleSpoiler);

export const statusListSchema = z.array(statusSchema);

export const pixelfedStatusSchema = z
  .object({
    id: z.string(),
    created_at: z.string(),
    url: z.string(),
    content: z.string(),
    spoiler_text: z
      .string()
      .nullish()
      .transform((value) => value ?? ''),
    sensitive: z
      .boolean()
      .nullish()
      .transform((value) => value ?? false),
    visibility: z.string(),
    favourites_count: z.number().int().nonnegative(),
    reblogs_count: z.number().int().nonnegative(),
    reply_count: z.number().int().nonnegative().nullish(),
    replies_count: z.number().int().nonnegative().nullish(),
    in_reply_to_id: z
      .string()
      .nullish()
      .transform((value) => value ?? null),
    in_reply_to_account_id: z
      .string()
      .nullish()
      .transform((value) => value ?? null),
    media_attachments: z.array(mediaAttachmentSchema).default([]),
  })
  .transform((status) => ({
    ...status,
    replies_count: status.reply_count ?? status.replies_count ?? 0,
  }));

export const pixelfedStatusListSchema = z.array(pixelfedStatusSchema);

export const statusWithAccountSchema = statusObjectSchema
  .extend({
    account: accountSchema,
  })
  .transform(stripFriendicaTitleSpoiler);

export const statusContextSchema = z.object({
  ancestors: z.array(statusWithAccountSchema),
  descendants: z.array(statusWithAccountSchema),
});

export const instanceSchema = z.object({
  domain: z.string().optional(),
  title: z.string().optional(),
  version: z.string().optional(),
});

export const nodeInfoIndexSchema = z.object({
  links: z.array(
    z.object({
      rel: z.string(),
      href: z.string(),
    }),
  ),
});

export const nodeInfoSchema = z.object({
  software: z.object({
    name: z.string(),
  }),
});

export const webFingerSchema = z.object({
  links: z.array(
    z.object({
      rel: z.string(),
      type: z.string().optional(),
      href: z.string().optional(),
    }),
  ),
});

export const appRegistrationSchema = z.object({
  client_id: z.string(),
  client_secret: z.string(),
});

export const oauthTokenSchema = z.object({
  access_token: z.string(),
});

export const followerNotificationSchema = z.object({
  id: z.string(),
  type: z.string(),
  created_at: z.string(),
});

export const followerNotificationListSchema = z.array(followerNotificationSchema);

export const reblogNotificationSchema = z.object({
  id: z.string(),
  type: z.literal('reblog'),
  created_at: z.string().datetime({ offset: true }),
  status: z.object({ id: z.string() }),
});

export const reblogNotificationListSchema = z.array(reblogNotificationSchema);

export const cardShareTokenSchema = z.object({
  token: z.string().min(1),
  expiresIn: z.number().int().positive(),
});

export const cardServiceResponseSchema = z.object({
  id: z.string().min(1).max(12),
  url: z.string().url(),
  imageUrl: z.string().url(),
  createdAt: z.string().datetime({ offset: true }),
});
