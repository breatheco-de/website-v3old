import { Card } from "@/components/ui/card";
import { UniversalVideo } from "@/components/UniversalVideo";

export interface CardDeckItem {
  video?: {
    url: string;
    preview_image_url?: string;
  };
  image?: string;
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
    <section className="max-w-6xl mx-auto px-4">
      <div
        className="grid grid-cols-1 md:grid-cols-3 gap-4 w-full"
        data-testid="cards-deck-container"
      >
        {cards.map((card, index) => {
          const hasMedia = card.image || (card.video && card.video.url);

          return (
            <Card
              key={index}
              className="overflow-visible flex flex-col"
              data-testid={`card-deck-item-${index}`}
            >
              {hasMedia && (
                <div
                  className="w-full overflow-hidden"
                  style={{ height: "200px" }}
                  data-testid={card.image ? `card-deck-image-${index}` : `card-deck-video-${index}`}
                >
                  {card.image ? (
                    <img
                      src={card.image}
                      alt={card.title}
                      className="w-full h-full object-cover rounded-t-md"
                    />
                  ) : card.video ? (
                    <UniversalVideo
                      url={card.video.url}
                      preview_image_url={card.video.preview_image_url}
                      muted
                      autoplay={false}
                      loop={false}
                      className="w-full h-full [&>div]:!pt-0 [&>div]:h-full !rounded-b-none"
                    />
                  ) : null}
                </div>
              )}
              <div className="flex flex-col gap-1 px-4">
                {(card.brandImage || card.authorName) && (
                  <div
                    className="flex items-start justify-between gap-2 flex-wrap pt-2"
                    data-testid={`card-deck-author-row-${index}`}
                  >
                    {card.brandImage && (
                      <img
                        src={card.brandImage}
                        alt=""
                        className=" h-6 flex-shrink-0"
                        data-testid={`card-deck-brand-image-${index}`}
                      />
                    )}
                  </div>
                )}
                {card.authorName && (
                  <span
                    className="text-sm text-muted-foreground pt-1 pb-2"
                    data-testid={`card-deck-author-name-${index}`}
                  >
                    {card.authorName}
                  </span>
                )}
                <div className="">
                  <h3
                    className="text-[22px] font-semibold pb-2 leading-[28px]"
                    data-testid={`card-deck-title-${index}`}
                  >
                    {card.title}
                  </h3>

                  <p
                    className="text-muted-foreground pb-4 text-base"
                    data-testid={`card-deck-description-${index}`}
                  >
                    {card.description}
                  </p>
                </div>
              </div>
            </Card>
          );
        })}
      </div>
    </section>
  );
}
