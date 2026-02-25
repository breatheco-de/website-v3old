import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { IconStarFilled, IconStar } from "@tabler/icons-react";
import { useTranslation } from "react-i18next";
import collabImage from "@assets/generated_images/Students_collaborating_workspace_d1560810.webp";
import happyDevImage from "@assets/generated_images/Happy_developer_portrait_1d924db5.webp";
import womanCodingImage from "@assets/generated_images/Woman_coding_portrait_fa2041e2.webp";
import teamImage from "@assets/generated_images/Tech_team_group_photo_4a9b4011.webp";
import avatar1 from "@assets/generated_images/Woman_profile_headshot_1_608aff01.webp";
import avatar2 from "@assets/generated_images/Man_profile_headshot_1_0850c276.webp";
import avatar3 from "@assets/generated_images/Woman_profile_headshot_2_a0ea2c29.webp";
import avatar4 from "@assets/generated_images/Man_profile_headshot_2_516b72e4.webp";
import { useImageRegistry } from "@/components/UniversalImage";

export default function LandingHero() {
  const { t } = useTranslation();
  const { registry } = useImageRegistry();
  const curvedArrow = registry?.images?.["curved-arrow-with-loop-1763159963338"]?.src;

  return (
    <section className="relative container mx-auto px-4 overflow-hidden">
      <div className="grid grid-cols-1 lg:grid-cols-[1fr_2fr_1fr] gap-8 items-start max-w-7xl mx-auto">
        {/* Left Images Column */}
        <div className="relative h-[300px] lg:h-[500px] hidden lg:block">
          {/* Photo Card 1 - Top */}
          <div
            className="absolute top-[94px] left-0 w-56 transform -rotate-6 transition-transform duration-brand ease-brand hover:rotate-0 hover:scale-[1.02] z-30"
            style={{ boxShadow: "0 10px 30px rgba(0,0,0,0.15)" }}
          >
            <img
              src={collabImage}
              alt={t("hero.altImage1")}
              className="w-full h-48 object-cover rounded-lg"
              loading="lazy"
            />
          </div>

          {/* Photo Card 2 - Overlapping */}
          <div
            className="absolute top-[222px] left-[100px] w-56 transform rotate-3 transition-transform duration-brand ease-brand hover:rotate-0 hover:scale-[1.02] z-30"
            style={{ boxShadow: "0 10px 30px rgba(0,0,0,0.15)" }}
          >
            <img
              src={happyDevImage}
              alt={t("hero.altImage4")}
              className="w-full h-48 object-cover rounded-lg"
              loading="lazy"
            />
          </div>
        </div>

        {/* Content Column (Center) */}
        <div className="z-10 text-center px-4">
          <h1 className="text-h1 mb-6 whitespace-nowrap">
            {t("hero.title")}
          </h1>

          <p className="text-body text-muted-foreground mb-6 max-w-2xl md:max-w-xl mx-auto">
            {t("hero.subtitle")}
          </p>

          {/* Ratings Bar */}
          <div className="flex items-center justify-center gap-3 mb-8">
            <div className="flex -space-x-2">
              <Avatar className="h-8 w-8 border-2 border-background">
                <AvatarImage src={avatar1} alt={t("hero.altAvatar1")} />
                <AvatarFallback className="bg-primary/20 text-xs">
                  SJ
                </AvatarFallback>
              </Avatar>
              <Avatar className="h-8 w-8 border-2 border-background">
                <AvatarImage src={avatar2} alt={t("hero.altAvatar2")} />
                <AvatarFallback className="bg-blue-500/20 text-xs">
                  MC
                </AvatarFallback>
              </Avatar>
              <Avatar className="h-8 w-8 border-2 border-background">
                <AvatarImage src={avatar3} alt={t("hero.altAvatar3")} />
                <AvatarFallback className="bg-green-500/20 text-xs">
                  ER
                </AvatarFallback>
              </Avatar>
              <Avatar className="h-8 w-8 border-2 border-background">
                <AvatarImage src={avatar4} alt={t("hero.altAvatar4")} />
                <AvatarFallback className="bg-purple-500/20 text-xs">
                  DK
                </AvatarFallback>
              </Avatar>
            </div>

            <div className="flex flex-col items-start gap-1">
              <div className="flex items-center gap-2">
                <span className="font-semibold">{t("hero.rating")}</span>
                <div className="flex">
                  {[1, 2, 3, 4].map((i) => (
                    <IconStarFilled
                      key={i}
                      className="text-yellow-500 w-5 h-5"
                    />
                  ))}
                  <div className="relative w-5 h-5">
                    <IconStar className="text-yellow-500 w-5 h-5 absolute inset-0" />
                    <IconStarFilled 
                      className="text-yellow-500 w-5 h-5 absolute inset-0"
                      style={{ clipPath: "inset(0 50% 0 0)" }}
                    />
                  </div>
                </div>
              </div>
              <span className="text-sm text-muted-foreground">
                {t("hero.trustedBy")}
              </span>
            </div>
          </div>

          {/* Curved arrow - hidden on mobile */}
          {curvedArrow && (
            <div className="hidden lg:flex justify-center mb-4">
              <img
                src={curvedArrow}
                alt={t("hero.altArrow")}
                className="w-24 h-auto opacity-80"
                loading="lazy"
              />
            </div>
          )}

          {/* CTA Button */}
          <div>
            <Button
              size="lg"
              className="text-body px-8 mb-1"
              data-testid="button-choose-path"
            >
              {t("hero.cta")}
            </Button>
          </div>
        </div>

        {/* Right Images Column */}
        <div className="relative h-[300px] lg:h-[500px] hidden lg:block">
          {/* Photo Card 3 - Top */}
          <div
            className="absolute top-[94px] right-0 w-56 transform rotate-6 transition-transform duration-brand ease-brand hover:rotate-0 hover:scale-[1.02] z-30"
            style={{ boxShadow: "0 10px 30px rgba(0,0,0,0.15)" }}
          >
            <img
              src={womanCodingImage}
              alt={t("hero.altImage2")}
              className="w-full h-48 object-cover rounded-lg"
              loading="lazy"
            />
          </div>

          {/* Photo Card 4 - Overlapping */}
          <div
            className="absolute top-[222px] right-[100px] w-56 transform -rotate-3 transition-transform duration-brand ease-brand hover:rotate-0 hover:scale-[1.02] z-20"
            style={{ boxShadow: "0 10px 30px rgba(0,0,0,0.15)" }}
          >
            <img
              src={teamImage}
              alt={t("hero.altImage3")}
              className="w-full h-48 object-cover rounded-lg"
              loading="lazy"
            />
          </div>
        </div>
      </div>

      {/* Subtle gradient background */}
      <div className="absolute inset-0 bg-gradient-to-br from-primary/5 via-transparent to-chart-2/5 pointer-events-none -z-10"></div>
    </section>
  );
}
