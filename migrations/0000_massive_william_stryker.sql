CREATE TABLE "ai_knowledge" (
        "id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
        "key" text NOT NULL,
        "value" jsonb NOT NULL,
        "updated_at" timestamp DEFAULT now(),
        "updated_by" text,
        CONSTRAINT "ai_knowledge_key_unique" UNIQUE("key")
);
--> statement-breakpoint
CREATE TABLE "conversation_messages" (
        "id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
        "conversation_id" varchar NOT NULL,
        "role" text NOT NULL,
        "content" text NOT NULL,
        "question_tag" text,
        "rating" text,
        "rated_by" text,
        "rated_at" timestamp,
        "override_content" text,
        "override_by" text,
        "override_at" timestamp,
        "created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "conversations" (
        "id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
        "page_url" text,
        "content_type" text,
        "content_slug" text,
        "locale" text DEFAULT 'en',
        "feature_tags" text[] DEFAULT '{}'::text[],
        "visitor_id" text,
        "started_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "users" (
        "id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
        "username" text NOT NULL,
        "password" text NOT NULL,
        CONSTRAINT "users_username_unique" UNIQUE("username")
);
