import { Card } from "@/components/ui/card";
import { UniversalVideo } from "@/components/UniversalVideo";

export interface CardDeckItem {
  video?: {
    url: string;
    preview_image_url?: string;
  };
  brandImage?: string;
  authorName?: string;
  title: string;
  description: string;
}

export interface CardsDeckDefaultProps {
  data: {
    type: string;
    variant?: string;
    cards: CardDeckItem[];
  };
}

export function CardsDeckDefault({ data }: CardsDeckDefaultProps) {
  const { cards } = data;

  return (
    <div
      className="grid grid-cols-1 md:grid-cols-3 gap-4 w-full"
      data-testid="cards-deck-container"
    >
      {cards.map((card, index) => (
        <Card
          key={index}
          className="overflow-visible flex flex-col"
          data-testid={`card-deck-item-${index}`}
        >
          {card.video && (
            <div
              className="w-full overflow-hidden rounded-t-[inherit]"
              style={{ height: "200px" }}
              data-testid={`card-deck-video-${index}`}
            >
              <UniversalVideo
                url={card.video.url}
                preview_image_url={card.video.preview_image_url}
                muted
                autoplay={false}
                loop={false}
                className="w-full h-full [&>div]:!pt-0 [&>div]:h-full"
              />
            </div>
          )}

          <div className="p-card-padding flex flex-col gap-3">
            {(card.brandImage || card.authorName) && (
              <div
                className="flex items-center gap-2 flex-wrap"
                data-testid={`card-deck-author-row-${index}`}
              >
                {card.brandImage && (
                  <img
                    src={card.brandImage}
                    alt=""
                    className="w-8 h-8 rounded-md object-cover flex-shrink-0"
                    data-testid={`card-deck-brand-image-${index}`}
                  />
                )}
                {card.authorName && (
                  <span
                    className="text-sm text-muted-foreground"
                    data-testid={`card-deck-author-name-${index}`}
                  >
                    {card.authorName}
                  </span>
                )}
              </div>
            )}

            <h3
              className="text-lg font-semibold leading-snug"
              data-testid={`card-deck-title-${index}`}
            >
              {card.title}
            </h3>

            <p
              className="text-sm text-muted-foreground"
              data-testid={`card-deck-description-${index}`}
            >
              {card.description}
            </p>
          </div>
        </Card>
      ))}
    </div>
  );
}
