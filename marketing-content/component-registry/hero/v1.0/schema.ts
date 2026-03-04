/**
 * Hero Component Schemas - v1.0
 * All hero variant Zod schemas for validation
 */
import { z } from "zod";
import { ctaButtonSchema, videoConfigSchema, leadFormDataSchema } from "../../_common/schema";
import { awardsMarqueeItemSchema } from "../../awards_marquee/v1.0/schema";

// Trust bar for singleColumn variant
export const trustBarSchema = z.object({
  rating: z.string().optional(),
  rating_count: z.string().optional(),
  trusted_text: z.string(),
  avatars: z.array(z.string()).optional(),
});

// Award badge
export const awardBadgeSchema = z.object({
  name: z.string(),
  source: z.string(),
  year: z.string().optional(),
});

// Hero image
export const heroImageSchema = z.object({
  src: z.string(),
  alt: z.string(),
});

// Brand mark for productShowcase
export const brandMarkSchema = z.object({
  prefix: z.string().optional(),
  highlight: z.string(),
  suffix: z.string().optional(),
  color: z.enum(["primary", "accent", "destructive", "chart-1", "chart-2", "chart-3", "chart-4", "chart-5"]).optional(),
});

// Review logo for productShowcase trust bar
export const reviewLogoSchema = z.object({
  name: z.string(),
  logo: z.string().optional(),
});

// Trust bar for productShowcase
export const productShowcaseTrustBarSchema = z.object({
  rating: z.string().optional(),
  review_count: z.string().optional(),
  review_logos: z.array(reviewLogoSchema).optional(),
});

// Embedded marquee for productShowcase (renders below description)
export const embeddedMarqueeSchema = z.object({
  items: z.array(awardsMarqueeItemSchema),
  speed: z.number().optional(),
  gradient: z.boolean().optional(),
  gradientColor: z.string().optional(),
  gradientWidth: z.number().optional(),
});

// Bullet item for productShowcase (renders below description)
export const bulletItemSchema = z.object({
  text: z.string(),
});

// Course tutor
export const heroCourseTutorSchema = z.object({
  name: z.string(),
  role: z.string(),
  image: z.string(),
});

// Course feature
export const heroCourseFeatureSchema = z.object({
  icon: z.string(),
  text: z.string(),
  count: z.union([z.string(), z.number()]).optional(),
});

// ============================================
// Hero Variant Schemas
// ============================================

export const heroSingleColumnSchema = z.object({
  type: z.literal("hero"),
  version: z.string().optional(),
  variant: z.literal("singleColumn"),
  title: z.string(),
  subtitle: z.string().optional(),
  badge: z.string().optional(),
  cta_buttons: z.array(ctaButtonSchema).optional(),
  trust_bar: trustBarSchema.optional(),
  award_badges: z.array(awardBadgeSchema).optional(),
  image: z.object({ src: z.string(), alt: z.string().optional() }).optional(),
  image_full_width: z.boolean().optional(),
  image_width: z.string().optional(),
}).passthrough();

export const heroShowcaseSchema = z.object({
  type: z.literal("hero"),
  version: z.string().optional(),
  variant: z.literal("showcase"),
  title: z.string(),
  subtitle: z.string().optional(),
  trust_bar: trustBarSchema.optional(),
  cta_button: ctaButtonSchema,
  left_images: z.array(heroImageSchema).optional(),
  right_images: z.array(heroImageSchema).optional(),
  show_arrow: z.boolean().optional(),
}).passthrough();

export const heroProductShowcaseSchema = z.object({
  type: z.literal("hero"),
  version: z.string().optional(),
  variant: z.literal("productShowcase"),
  title: z.string(),
  subtitle: z.string().optional(),
  welcome_text: z.string().optional(),
  brand_mark: brandMarkSchema.optional(),
  description: z.string().optional(),
  // Bullet points render below description (optional)
  bullets: z.array(bulletItemSchema).nullish(),
  // Embedded marquee renders below description (optional)
  marquee: embeddedMarqueeSchema.nullish(),
  video: videoConfigSchema.optional(),
  video_id: z.string().optional(),
  video_ratio: z.string().optional(),
  image: z.object({
    src: z.string(),
    alt: z.string(),
  }).nullish(),
  image_id: z.string().optional(),
  image_width: z.number().optional(),
  // NOTE: Background image is only displayed on screens >= 1280px width.
  // On smaller screens, a gradient fallback is shown instead for better mobile experience.
  background_image: z.object({
    src: z.string(),
    alt: z.string().optional(),
  }).nullish(),
  // Decorative images displayed on left and right sides (optional)
  left_images: z.array(heroImageSchema).optional(),
  right_images: z.array(heroImageSchema).optional(),
  form: leadFormDataSchema.nullish(),
  cta_button: ctaButtonSchema.nullish(),
  trust_bar: productShowcaseTrustBarSchema.nullish(),
}).passthrough();

export const heroSimpleTwoColumnSchema = z.object({
  type: z.literal("hero"),
  version: z.string().optional(),
  variant: z.literal("simpleTwoColumn"),
  title: z.string(),
  subtitle: z.string().optional(),
  badge: z.string().optional(),
  image: z.union([
    z.object({ src: z.string(), alt: z.string() }),
    z.string(),
  ]).optional(),
  image_alt: z.string().optional(),
  image_object_fit: z.string().optional(),
  image_object_position: z.string().optional(),
  video: videoConfigSchema.optional(),
  cta_buttons: z.array(ctaButtonSchema).optional(),
  background: z.string().optional(),
}).passthrough();

export const heroSimpleStackedSchema = z.object({
  type: z.literal("hero"),
  version: z.string().optional(),
  variant: z.literal("simpleStacked"),
  title: z.string(),
  subtitle: z.string().optional(),
  badge: z.string().optional(),
  image: z.object({
    src: z.string(),
    alt: z.string(),
  }).optional(),
  cta_buttons: z.array(ctaButtonSchema).optional(),
  background: z.string().optional(),
}).passthrough();

export const heroTwoColumnSchema = z.object({
  type: z.literal("hero"),
  version: z.string().optional(),
  variant: z.literal("twoColumn"),
  title: z.string(),
  subtitle: z.string().optional(),
  badge: z.string().optional(),
  image: z.string().optional(),
  image_alt: z.string().optional(),
  cta_buttons: z.array(ctaButtonSchema).optional(),
  background: z.string().optional(),
}).passthrough();

export const heroCourseSchema = z.object({
  type: z.literal("hero"),
  version: z.string().optional(),
  variant: z.literal("course"),
  title: z.string(),
  title_highlight: z.string().optional(),
  subtitle: z.string().optional(),
  students_enrolled: z.object({
    avatars: z.array(z.string()).optional(),
    count: z.string(),
  }).optional(),
  bullet_points: z.array(z.string()).optional(),
  rating: z.object({
    value: z.number(), // e.g., 4.5
    count: z.string(), // e.g., "(1346 Ratings)"
    reviews_anchor: z.string().optional(), // e.g., "#reviews" - links to reviews section
  }).optional(),
  tutors: z.array(heroCourseTutorSchema).optional(),
  tutors_label: z.string().optional(),
  description: z.string().optional(),
  video: videoConfigSchema.optional(),
  media: z.object({
    type: z.enum(["video", "image"]),
    src: z.string(),
    thumbnail: z.string().optional(),
    alt: z.string().optional(),
  }).optional(),
  signup_card: z.object({
    title: z.string(),
    description: z.string().optional(),
    form: leadFormDataSchema.optional(),
    cta_button: ctaButtonSchema.optional(),
    login_link: z.object({
      text: z.string(),
      url: z.string().optional(),
    }).optional(),
    features: z.array(heroCourseFeatureSchema).optional(),
  }),
  layout_reversed: z.boolean().optional(),
}).passthrough();

// ApplyFormProductShowcase variant - hero with application form and product showcase
export const heroApplyFormProductShowcaseSchema = z.object({
  type: z.literal("hero"),
  version: z.string().optional(),
  variant: z.literal("ApplyFormProductShowcase"),
  title: z.string(),
  brand_mark: brandMarkSchema.optional(),
  description: z.string().optional(),
  form: leadFormDataSchema,
  cta_button: ctaButtonSchema.optional(),
  trust_bar: productShowcaseTrustBarSchema.optional(),
  video: z.object({
    url: z.string(),
    title: z.string().optional(),
    ratio: z.string().optional(),
    mobile_ratio: z.string().optional(),
    muted: z.boolean().optional(),
    autoplay: z.boolean().optional(),
    loop: z.boolean().optional(),
    preview_image_url: z.string().optional(),
    with_shadow_border: z.boolean().optional(),
  }).optional(),
  image: z.object({
    src: z.string(),
    alt: z.string(),
  }).optional(),
}).passthrough();

// Combined hero section schema
export const heroSectionSchema = z.union([
  heroSingleColumnSchema,
  heroShowcaseSchema,
  heroProductShowcaseSchema,
  heroSimpleTwoColumnSchema,
  heroSimpleStackedSchema,
  heroTwoColumnSchema,
  heroCourseSchema,
  heroApplyFormProductShowcaseSchema,
]);

// Type exports
export type TrustBar = z.infer<typeof trustBarSchema>;
export type AwardBadge = z.infer<typeof awardBadgeSchema>;
export type HeroImage = z.infer<typeof heroImageSchema>;
export type BrandMark = z.infer<typeof brandMarkSchema>;
export type ReviewLogo = z.infer<typeof reviewLogoSchema>;
export type ProductShowcaseTrustBar = z.infer<typeof productShowcaseTrustBarSchema>;
export type EmbeddedMarquee = z.infer<typeof embeddedMarqueeSchema>;
export type BulletItem = z.infer<typeof bulletItemSchema>;
export type HeroCourseTutor = z.infer<typeof heroCourseTutorSchema>;
export type HeroCourseFeature = z.infer<typeof heroCourseFeatureSchema>;
export type HeroSingleColumn = z.infer<typeof heroSingleColumnSchema>;
export type HeroShowcase = z.infer<typeof heroShowcaseSchema>;
export type HeroProductShowcase = z.infer<typeof heroProductShowcaseSchema>;
export type HeroSimpleTwoColumn = z.infer<typeof heroSimpleTwoColumnSchema>;
export type HeroSimpleStacked = z.infer<typeof heroSimpleStackedSchema>;
export type HeroTwoColumn = z.infer<typeof heroTwoColumnSchema>;
export type HeroCourse = z.infer<typeof heroCourseSchema>;
export type HeroApplyFormProductShowcase = z.infer<typeof heroApplyFormProductShowcaseSchema>;
export type HeroSection = z.infer<typeof heroSectionSchema>;
