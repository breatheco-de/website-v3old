export const variant = "default";

import { Card, CardContent } from "@/components/ui/card";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";

interface AccordionBullet {
  heading: string;
  text: string;
}

interface TwoColumnAccordionCardDefaultData {
  title?: string;
  description?: string;
  bullets?: AccordionBullet[];
  footer?: string;
  image?: string;
  image_alt?: string;
  image_object_fit?: "cover" | "contain" | "fill" | "none" | "scale-down";
  image_object_position?: string;
  reverse?: boolean;
}

interface TwoColumnAccordionCardDefaultProps {
  data: TwoColumnAccordionCardDefaultData;
}

export default function TwoColumnAccordionCardDefault({ data }: TwoColumnAccordionCardDefaultProps) {
  const { title, description, bullets, footer, image, image_alt, image_object_fit, image_object_position, reverse } = data;

  return (
    <section className="" data-testid="section-two-column-accordion-card">
      <div className="max-w-6xl mx-auto px-4">
        <Card className="overflow-hidden shadow-sm">
          <CardContent className="p-0">
            <div className={`grid grid-cols-1 md:grid-cols-12 md:min-h-[580px] ${reverse ? "md:flex-row-reverse" : ""}`}>
              <div className={`col-span-1 md:col-span-7 p-6 md:p-10 flex flex-col justify-center ${reverse ? "md:order-2" : "md:order-1"}`}>
                {title && (
                  <h2 
                    className="text-h2 text-foreground mb-4"
                    data-testid="text-two-column-accordion-title"
                  >
                    {title}
                  </h2>
                )}
                
                {description && (
                  <p 
                    className="text-muted-foreground mb-6"
                    data-testid="text-two-column-accordion-description"
                  >
                    {description}
                  </p>
                )}

                {bullets && bullets.length > 0 && (
                  <Accordion type="single" collapsible defaultValue="item-0" className="w-full" data-testid="accordion-bullets">
                    {bullets.map((bullet, index) => (
                      <AccordionItem key={index} value={`item-${index}`}>
                        <AccordionTrigger className="text-left font-semibold text-foreground hover:no-underline py-2 md:py-4">
                          {bullet.heading}
                        </AccordionTrigger>
                        <AccordionContent className="text-muted-foreground">
                          {bullet.text}
                        </AccordionContent>
                      </AccordionItem>
                    ))}
                  </Accordion>
                )}

                {footer && (
                  <p 
                    className="text-muted-foreground mt-6 text-sm italic"
                    data-testid="text-two-column-accordion-footer"
                  >
                    {footer}
                  </p>
                )}
              </div>

              {image && (
                <div className={`col-span-1 md:col-span-5 flex items-center justify-center p-6 md:p-8 bg-muted/30 ${reverse ? "md:order-1" : "md:order-2"}`}>
                  <img
                    src={image}
                    alt={image_alt || ""}
                    className="w-full max-w-[300px] md:max-w-full rounded-lg"
                    style={{
                      objectFit: image_object_fit || "contain",
                      objectPosition: image_object_position || "center center",
                    }}
                    data-testid="img-two-column-accordion"
                  />
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </section>
  );
}
