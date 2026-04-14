
import { Card } from "@/components/ui/card";
import { IconStarFilled } from "@tabler/icons-react";
import { UniversalImage } from "@/components/UniversalImage";
import type { TrustCardsSection } from "@shared/schema";

function StarRating({ rating }: { rating: number }) {
  const fullStars = Math.floor(rating);
  const hasHalf = rating % 1 >= 0.5;

  return (
    <div className="flex" data-testid="stars-rating">
      {[1, 2, 3, 4, 5].map((star) => {
        const isHalfStar = hasHalf && star === fullStars + 1;

        if (star <= fullStars) {
          return (
            <IconStarFilled
              key={star}
              className="h-4 w-4 md:h-5 md:w-5 text-yellow-500"
            />
          );
        } else if (isHalfStar) {
          return (
            <div key={star} className="relative h-4 w-4 md:h-5 md:w-5">
              <IconStarFilled className="h-4 w-4 md:h-5 md:w-5 text-muted" />
              <div
                className="absolute inset-0 overflow-hidden"
                style={{ width: "50%" }}
              >
                <IconStarFilled className="h-4 w-4 md:h-5 md:w-5 text-yellow-500" />
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
  );
}

interface TrustCardsProps {
  data: TrustCardsSection;
}

export default function TrustCards({ data }: TrustCardsProps) {
  return (
    <section data-testid="section-trust-cards">
      {(data.title || data.subtitle) && (
        <div className="text-center mb-8">
          {data.title && (
            <h2
              className="text-2xl md:text-3xl font-bold text-foreground"
              data-testid="text-trust-cards-title"
            >
              {data.title}
            </h2>
          )}
          {data.subtitle && (
            <p
              className="mt-2 text-muted-foreground"
              data-testid="text-trust-cards-subtitle"
            >
              {data.subtitle}
            </p>
          )}
        </div>
      )}

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {data.items.map((item, index) => (
          <Card
            key={index}
            className="flex flex-col items-center justify-center gap-3 p-4"
            data-testid={`card-trust-${index}`}
          >
            <div className="max-h-[38px] md:max-h-[50px] flex items-center justify-center mx-8">
              <UniversalImage
                id={item.image}
                alt={item.trusted_text || `Review platform ${index + 1}`}
                className="h-full object-contain"
                style={{ objectFit: "contain" }}
                fieldContext={{ arrayPath: "items", index, srcField: "image" }}
              />
            </div>

            <div className="flex items-center gap-2 flex-wrap justify-center">
              <StarRating rating={item.rating} />
              {item.review_count && (
                <span
                  className="text-xs text-muted-foreground whitespace-nowrap"
                  data-testid={`text-review-count-${index}`}
                >
                  {item.review_count}
                </span>
              )}
              {item.trusted_text && (
                <span
                  className="text-sm font-medium text-muted-foreground"
                  data-testid={`text-trusted-${index}`}
                >
                  {item.trusted_text}
                </span>
              )}
            </div>

          </Card>
        ))}
      </div>
    </section>
  );
}
