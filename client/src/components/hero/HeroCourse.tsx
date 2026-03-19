import type { HeroCourse as HeroCourseType } from "@shared/schema";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { IconCheck, IconBook, IconStarFilled } from "@tabler/icons-react";
import { UniversalVideo } from "@/components/UniversalVideo";
import { getIcon } from "@/lib/icons";
import { cn } from "@/lib/utils";
import { useInternalNav } from "@/hooks/useInternalNav";
import { RichTextContent } from "@/components/ui/rich-text-content";
import { resolveTemplateFallback } from "@/lib/variable-manager";
import { lazy, Suspense } from "react";

const LeadForm = lazy(() =>
  import("@/components/LeadForm").then((m) => ({
    default: m.default || m.LeadForm,
  })),
);

interface HeroCourseProps {
  data: HeroCourseType;
}

export function HeroCourse({ data }: HeroCourseProps) {
  const handleLinkClick = useInternalNav();
  return (
    <section className="bg-background" data-testid="section-hero">
      <div className="max-w-6xl mx-auto px-4">
        <div
          className={cn(
            "grid gap-8 lg:gap-12",
            data.layout_reversed
              ? "lg:grid-cols-[2fr_3fr]"
              : "lg:grid-cols-[3fr_2fr]",
          )}
        >
          {/* Content column (left by default, right when reversed) */}
          <div
            className={cn("space-y-6", data.layout_reversed && "lg:order-2")}
          >
            <h1
              className="text-h1 text-foreground"
              data-testid="text-hero-title"
            >
              {data.title_highlight &&
              data.title.includes(data.title_highlight) ? (
                <>
                  {data.title.split(data.title_highlight)[0]}
                  <span className="text-primary">{data.title_highlight}</span>
                  {data.title.split(data.title_highlight)[1]}
                </>
              ) : (
                data.title
              )}
            </h1>

            {data.subtitle && (
              <p
                className="text-body text-muted-foreground"
                data-testid="text-hero-subtitle"
              >
                {data.subtitle}
              </p>
            )}

            {data.students_enrolled && (
              <div className="flex items-center gap-3">
                {data.students_enrolled.avatars &&
                  data.students_enrolled.avatars.length > 0 && (
                    <div className="flex -space-x-2">
                      {data.students_enrolled.avatars
                        .slice(0, 4)
                        .map((avatar, index) => (
                          <Avatar
                            key={index}
                            className="w-8 h-8 border-2 border-background"
                          >
                            <AvatarImage
                              src={avatar}
                              alt={`Student ${index + 1}`}
                            />
                            <AvatarFallback className="text-xs">
                              S{index + 1}
                            </AvatarFallback>
                          </Avatar>
                        ))}
                    </div>
                  )}
                <span className="text-sm text-muted-foreground">
                  {data.students_enrolled.count}
                </span>
              </div>
            )}

            {data.bullet_points && data.bullet_points.length > 0 && (
              <ul className="space-y-3">
                {data.bullet_points.map((point, index) => (
                  <li key={index} className="flex items-start gap-3">
                    <IconCheck className="w-5 h-5 text-primary mt-0.5 flex-shrink-0" />
                    <span className="text-foreground">{point}</span>
                  </li>
                ))}
              </ul>
            )}

            {data.rating && (
              <div
                className="flex items-center gap-2"
                data-testid="hero-rating"
              >
                <span className="text-foreground font-medium">
                  {String(data.rating.value)}
                </span>
                <div className="flex">
                  {[1, 2, 3, 4, 5].map((star) => {
                    const ratingNum =
                      parseFloat(
                        resolveTemplateFallback(String(data.rating!.value)),
                      ) || 0;
                    const fullStars = Math.floor(ratingNum);
                    const hasHalf = ratingNum % 1 >= 0.5;
                    const isHalfStar = hasHalf && star === fullStars + 1;

                    if (star <= fullStars) {
                      return (
                        <IconStarFilled
                          key={star}
                          className="h-5 w-5 text-yellow-500"
                        />
                      );
                    } else if (isHalfStar) {
                      return (
                        <div key={star} className="relative h-5 w-5">
                          <IconStarFilled className="h-5 w-5 text-muted" />
                          <div
                            className="absolute inset-0 overflow-hidden"
                            style={{ width: "50%" }}
                          >
                            <IconStarFilled className="h-5 w-5 text-yellow-500" />
                          </div>
                        </div>
                      );
                    } else {
                      return (
                        <IconStarFilled
                          key={star}
                          className="h-5 w-5 text-muted"
                        />
                      );
                    }
                  })}
                </div>
                {data.rating.reviews_anchor ? (
                  <a
                    href={data.rating.reviews_anchor}
                    onClick={handleLinkClick}
                    className="text-primary hover:underline text-sm"
                    data-testid="link-hero-rating"
                  >
                    {String(data.rating.count)}
                  </a>
                ) : (
                  <span className="text-muted-foreground text-sm">
                    {String(data.rating.count)}
                  </span>
                )}
              </div>
            )}

            {data.tutors && data.tutors.length > 0 && (
              <div className="pt-4">
                <p className="text-sm font-medium text-muted-foreground mb-3">
                  {data.tutors_label || "Your tutors:"}
                </p>
                <div className="flex flex-wrap gap-4">
                  {data.tutors.map((tutor, index) => (
                    <div
                      key={index}
                      className="flex items-center gap-3 bg-muted rounded-lg px-3 py-2"
                    >
                      <Avatar className="w-10 h-10">
                        <AvatarImage src={tutor.image} alt={tutor.name} />
                        <AvatarFallback>{tutor.name.charAt(0)}</AvatarFallback>
                      </Avatar>
                      <div>
                        <p className="font-medium text-sm text-primary">
                          {tutor.name}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {tutor.role}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {data.description && (
              <p className="text-foreground leading-relaxed pt-4">
                {data.description}
              </p>
            )}
          </div>

          {/* Media + signup column (right by default, left when reversed) */}
          <div
            className={cn("space-y-4", data.layout_reversed && "lg:order-1")}
          >
            {(data.video?.url?.trim() || data.media) && (
              <div className="relative rounded-lg overflow-hidden aspect-video">
                {data.video?.url?.trim() ? (
                  <UniversalVideo
                    url={data.video.url}
                    ratio={data.video.ratio || "16:9"}
                    autoplay={data.video.autoplay !== false}
                    muted={data.video.muted !== false}
                    loop={data.video.loop !== false}
                    preview_image_url={data.video.preview_image_url}
                  />
                ) : data.media?.type === "video" ? (
                  <UniversalVideo
                    url={data.media.src}
                    ratio="16:9"
                    autoplay={true}
                    muted={true}
                    loop={true}
                  />
                ) : data.media ? (
                  <img
                    src={data.media.src}
                    alt={data.media.alt || "Hero image"}
                    className="w-full h-full object-cover"
                  />
                ) : null}
              </div>
            )}

            {/* Signup Card */}
            {data.signup_card && 
            <Card className="p-6">
              <h3 className="text-xl font-semibold mb-2">
                {data.signup_card?.title}
              </h3>
              {data.signup_card?.description && (
                <p className="text-sm text-muted-foreground mb-4">
                  {data.signup_card?.description}
                </p>
              )}

              {data.signup_card?.form && (
                <div data-hero-inline-form className="mb-2">
                  <Suspense
                    fallback={
                      <div className="h-24 flex items-center justify-center text-muted-foreground text-sm">
                        Loading...
                      </div>
                    }
                  >
                    <LeadForm data={data.signup_card?.form} />
                  </Suspense>
                </div>
              )}
              {data.signup_card?.cta_button && (
                <>
                  <Button
                    className="w-full mb-3"
                    size="lg"
                    variant={
                      data.signup_card?.cta_button.variant === "outline"
                        ? "outline"
                        : data.signup_card?.cta_button.variant === "secondary"
                          ? "secondary"
                          : "default"
                    }
                    data-testid="button-hero-cta"
                    asChild
                  >
                    <a
                      href={data.signup_card?.cta_button.url}
                      onClick={handleLinkClick}
                    >
                      {data.signup_card?.cta_button.text}
                    </a>
                  </Button>
                </>
              )}
              {data.signup_card?.login_link?.text &&
                (data.signup_card?.login_link.url ? (
                  <a
                    href={data.signup_card?.login_link.url}
                    onClick={handleLinkClick}
                    data-testid="link-hero-login"
                  >
                    <RichTextContent
                      html={data.signup_card?.login_link.text}
                      className="text-sm text-center text-muted-foreground mb-6 text-primary text-primary hover:underline"
                      data-testid="text-hero-login-link"
                    />
                  </a>
                ) : (
                  <RichTextContent
                    html={data.signup_card?.login_link.text}
                    className="text-sm text-center text-muted-foreground mb-6"
                    data-testid="text-hero-login-link"
                  />
                ))}
              {data.signup_card?.features &&
                data.signup_card?.features.length > 0 && (
                  <div className="border-t pt-4 space-y-3">
                    {data.signup_card?.features.map((feature, index) => {
                      const IconComponent = getIcon(feature.icon) || IconBook;
                      return (
                        <div
                          key={index}
                          className="flex items-center justify-between text-sm"
                        >
                          <div className="flex items-center gap-3">
                            <IconComponent className="w-4 h-4 text-muted-foreground" />
                            <span>{feature.text}</span>
                          </div>
                          {feature.count !== undefined && (
                            <span className="font-medium">{feature.count}</span>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
            </Card>
            }
          </div>
        </div>
      </div>
    </section>
  );
}
