import { Card } from "@/components/ui/card";
import { UniversalVideo } from "@/components/UniversalVideo";
import { UniversalImage } from "@/components/UniversalImage";
import { RichTextContent } from "@/components/ui/rich-text-content";

export interface CardDeckItem {
  video?: {
    url: string;
    preview_image_url?: string;
  };
  image?: string;
  brand_image?: string;
  author_name?: string;
  title: string;
  description: string;
}

export interface CardsDeckDefaultProps {
  data: {
    type: string;
    variant?: string;
    heading?: string;
    subtitle?: string;
    cards: CardDeckItem[];
  };
}

export function CardsDeckDefault({ data }: CardsDeckDefaultProps) {
  const { cards } = data;

  return (
    <section className="max-w-6xl mx-auto px-4">
      {(data.heading || data.subtitle) && (
        <div className="text-center mb-8">
          {data.heading && (
            <h2
              className="text-3xl md:text-4xl font-bold mb-4 text-foreground"
              data-testid="text-cards-deck-heading"
            >
              {data.heading}
            </h2>
          )}
          {data.subtitle && (
            <RichTextContent
              html={data.subtitle}
              className="text-lg text-muted-foreground max-w-3xl mx-auto [&_p]:mb-0"
              data-testid="text-cards-deck-subtitle"
            />
          )}
        </div>
      )}
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
                {(card.brand_image || card.author_name) && (
                  <div
                    className="flex items-start justify-between gap-2 flex-wrap pt-4"
                    data-testid={`card-deck-author-row-${index}`}
                  >
                    {card.brand_image && (
                      <div data-testid={`card-deck-brand-image-${index}`}>
                        <UniversalImage
                          id={card.brand_image}
                          alt=""
                          className="h-6 flex-shrink-0"
                          fieldContext={{ arrayPath: "cards", index, srcField: "brand_image" }}
                        />
                      </div>
                    )}
                  </div>
                )}
                {card.author_name && (
                  <span
                    className="text-sm text-muted-foreground pt-1 pb-2"
                    data-testid={`card-deck-author-name-${index}`}
                  >
                    {card.author_name}
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
