CREATE TABLE "cards" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" integer,
	"card_type" text NOT NULL,
	"print_option" text,
	"scene_type" text NOT NULL,
	"conversation_data" jsonb,
	"front_image_url" text,
	"inside_image_url" text,
	"status" text DEFAULT 'generating',
	"price" integer NOT NULL,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "loved_ones" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" integer,
	"name" text NOT NULL,
	"birthday" text NOT NULL,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "orders" (
	"id" serial PRIMARY KEY NOT NULL,
	"card_id" integer NOT NULL,
	"customer_email" text NOT NULL,
	"customer_name" text NOT NULL,
	"customer_phone" text NOT NULL,
	"amount" integer NOT NULL,
	"base_amount" integer DEFAULT 0 NOT NULL,
	"tip_amount" integer DEFAULT 0 NOT NULL,
	"currency" text DEFAULT 'ZAR' NOT NULL,
	"payment_reference" text NOT NULL,
	"payment_status" text DEFAULT 'pending' NOT NULL,
	"order_status" text DEFAULT 'processing' NOT NULL,
	"order_type" text DEFAULT 'regular' NOT NULL,
	"shipping_address" json,
	"tracking_number" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "orders_payment_reference_unique" UNIQUE("payment_reference")
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" serial PRIMARY KEY NOT NULL,
	"username" text NOT NULL,
	"email" text NOT NULL,
	"created_at" timestamp DEFAULT now(),
	CONSTRAINT "users_email_unique" UNIQUE("email")
);
--> statement-breakpoint
ALTER TABLE "cards" ADD CONSTRAINT "cards_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "loved_ones" ADD CONSTRAINT "loved_ones_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "orders" ADD CONSTRAINT "orders_card_id_cards_id_fk" FOREIGN KEY ("card_id") REFERENCES "public"."cards"("id") ON DELETE no action ON UPDATE no action;