import { z } from "zod";

export const pressMentionItemSchema = z.object({
  logo: z.string().optional(),
  logo_height: z.number().optional(),
  title: z.string(),
  excerpt: z.string(),
  link_text: z.string().optional(),
  link_url: z.string().optional(),
  box_color: z.string().optional(),
  title_color: z.string().optional(),
  excerpt_color: z.string().optional(),
  link_color: z.string().optional(),
});

export const pressMentionsSectionSchema = z.object({
  type: z.literal("press_mentions"),
  version: z.string().optional(),
  title: z.string().optional(),
  subtitle: z.string().optional(),
  title_color: z.string().optional(),
  subtitle_color: z.string().optional(),
  default_box_color: z.string().optional(),
  default_title_color: z.string().optional(),
  default_excerpt_color: z.string().optional(),
  default_link_color: z.string().optional(),
  default_logo_height: z.number().optional(),
  columns: z.number().optional(),
  items: z.array(pressMentionItemSchema).optional(),
  background: z.string().optional(),
});

export type PressMentionItem = z.infer<typeof pressMentionItemSchema>;
export type PressMentionsSection = z.infer<typeof pressMentionsSectionSchema>;
