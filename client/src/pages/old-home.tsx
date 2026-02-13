import Header from "@/components/Header";
import LandingHero from "@/components/LandingHero";
import LogoSection from "@/components/LogoSection";
import PersonalizedLearningSection from "@/components/PersonalizedLearningSection";
import FeatureSection from "@/components/FeatureSection";
import { TestimonialsSection } from "@/components/TestimonialsSection";
import IconFeatureGrid from "@/components/IconFeatureGrid";
import ImageTextSection from "@/components/ImageTextSection";
import SchemaOrg from "@/components/SchemaOrg";
import { Card, CardContent } from "@/components/ui/card";
import { useLocation } from "wouter";
import { useTranslation } from "react-i18next";
import {
  IconStarFilled,
  IconRoute,
  IconEye,
  IconBrain,
  IconTarget,
  IconTrendingUp,
  IconBriefcase,
  IconSchool,
  IconRefresh,
} from "@tabler/icons-react";
import rocketIcon from "@assets/generated_images/Rocket_launch_icon_76306c53.webp";
import communityIcon from "@assets/generated_images/Community_network_icon_a5c67162.webp";
import lightningIcon from "@assets/generated_images/Lightning_speed_icon_7822b42c.webp";
import collabImage from "@assets/generated_images/Students_collaborating_workspace_d1560810.webp";
import teamImage from "@assets/generated_images/Tech_team_group_photo_4a9b4011.webp";
import rigobotAvatar from "@assets/rigo-avatar_1763181725290.png";
import learner1 from "@assets/generated_images/South_Asian_woman_tech_professional_5cd2753e.webp";
import learner2 from "@assets/generated_images/Black_man_software_developer_4fbc5963.webp";
import learner3 from "@assets/generated_images/East_Asian_woman_engineer_8ba7b781.webp";
import learner4 from "@assets/generated_images/Hispanic_man_tech_student_992b89ae.webp";

export default function Home() {
  const [, setLocation] = useLocation();
  const { t } = useTranslation();

  const iconFeatures = [
    {
      icon: "https://images.prismic.io/4geeks/aBu1IydWJ-7kRuaG_imagen_2025-05-07_153146531.png?auto=format,compress",
      title: "Fast Launch",
      description:
        "Get started quickly with our streamlined onboarding and structured curriculum",
      color: "text-blue-500",
    },
    {
      icon: "https://images.prismic.io/4geeks/aBu4FydWJ-7kRub-_imagen_2025-05-07_154423512.png?auto=format,compress",
      title: "Global Community",
      description:
        "Join thousands of learners worldwide on the same journey to tech mastery",
      color: "text-yellow-500",
    },
    {
      icon: "https://images.prismic.io/4geeks/aBu2USdWJ-7kRuat_imagen_2025-05-07_153648922.png?auto=format,compress",
      title: "Self-paced courses",
      description: "Learn at your own pace with expert-guided resources.",
      color: "text-green-600",
    },
    {
      icon: "https://images.prismic.io/4geeks/aBu2kidWJ-7kRua__imagen_2025-05-07_153754062.png?auto=format,compress",
      title: "Career Booster",
      description: "Enhance your resume, networking, and interview skills.",
      color: "text-red-500",
    },
  ];

  const aiAutomations = [
    {
      label: "Adaptive, AI-driven learning paths",
      description:
        "Every student receives a LearnPack package generated from their diagnostics, past performance, pace, errors, and career goals.",
      icon: IconRoute,
      color: "border-t-blue-500",
      iconColor: "text-blue-500",
      onClick: () => setLocation("/career-programs"),
    },
    {
      label: "Human-guided calibration and oversight",
      description:
        "Expert mentors review student progress weekly and adjust the AI-generated path with human nuance and judgment.",
      icon: IconEye,
      color: "border-t-cyan-500",
      iconColor: "text-cyan-500",
      onClick: () => console.log("Human-guided calibration clicked"),
    },
    {
      label: "Deep, context-aware AI feedback",
      description:
        "Rigobot analyzes each student's code history and provides suggestions based on their patterns, not generic explanations.",
      icon: IconBrain,
      color: "border-t-pink-400",
      iconColor: "text-pink-400",
      onClick: () => console.log("Context-aware AI feedback clicked"),
    },
    {
      label: "Personalized skill-gap detection",
      description:
        "The platform automatically identifies weak areas from submissions and injects micro-lessons or extra challenges exactly where needed.",
      icon: IconTarget,
      color: "border-t-rose-500",
      iconColor: "text-rose-500",
      onClick: () => console.log("Skill-gap detection clicked"),
    },
    {
      label: "Individual pacing and progression",
      description:
        "Learners advance when they demonstrate mastery, not when the calendar says so; humans intervene when a student needs a strategic push or slowdown.",
      icon: IconTrendingUp,
      color: "border-t-green-500",
      iconColor: "text-green-500",
      onClick: () => console.log("Individual pacing clicked"),
    },
    {
      label: "Career-aligned project customization",
      description:
        "Assignments adapt to the student's target role (frontend, data, cybersecurity, AI), while career coaches refine the portfolio to match real employer expectations.",
      icon: IconBriefcase,
      color: "border-t-amber-500",
      iconColor: "text-amber-500",
      onClick: () => console.log("Career-aligned projects clicked"),
    },
    {
      label: "Human mentorship with AI augmentation",
      description:
        "Mentors see AI-generated insights about each student's patterns, letting them focus on high-impact coaching instead of repetitive troubleshooting.",
      icon: IconSchool,
      color: "border-t-yellow-500",
      iconColor: "text-yellow-500",
      onClick: () => console.log("AI-augmented mentorship clicked"),
    },
    {
      label: "Continuous re-personalization",
      description:
        "The learning path is re-generated as the student evolves; neither humans nor AI rely on a fixed curriculum but on continuous, data-driven adjustment.",
      icon: IconRefresh,
      color: "border-t-emerald-500",
      iconColor: "text-emerald-500",
      onClick: () => console.log("Re-personalization clicked"),
    },
  ];

  return (
    <div className="min-h-screen bg-background">
      <SchemaOrg type="organization" />
      <SchemaOrg type="website" />
      <SchemaOrg type="educational" />

      <Header />

      <LandingHero />

      <LogoSection />

      <PersonalizedLearningSection />

      <FeatureSection
        variant="notion"
        heading="Welcome to Hyper-personalized Learning."
        subheading="Progress Like Never Before."
        ctaLabel="Explore all automations"
        ctaHref="/courses"
        actions={aiAutomations}
        decorations={[
          { src: rigobotAvatar, alt: "Rigobot AI Tutor" },
          { src: learner1, alt: "Priya S." },
          { src: learner2, alt: "Marcus J." },
          { src: learner3, alt: "Yuki M." },
          { src: learner4, alt: "Diego R." },
        ]}
      />

      <TestimonialsSection
        testimonials={[
          {
            id: "1",
            name: "Sarah Johnson",
            role: "Software Engineer at Google",
            course: "Full Stack Web Development",
            rating: 5,
            comment:
              "This course completely transformed my career. The instructors are incredibly knowledgeable and the curriculum is perfectly structured for real-world applications.",
          },
          {
            id: "2",
            name: "Michael Chen",
            role: "Data Analyst at Meta",
            course: "Data Science & Analytics",
            rating: 5,
            comment:
              "Best investment I ever made. Got a job offer before even finishing the program! The mentorship and career support were invaluable.",
          },
          {
            id: "3",
            name: "Emily Rodriguez",
            role: "ML Engineer at Amazon",
            course: "AI & Machine Learning",
            rating: 5,
            comment:
              "Excellent content and great support from mentors. The projects were challenging but rewarding, and now I'm working on cutting-edge AI.",
          },
          {
            id: "4",
            name: "David Kim",
            role: "Full Stack Developer",
            course: "Full Stack Web Development",
            rating: 5,
            comment:
              "From zero coding knowledge to landing my dream job in 4 months. The structured curriculum and hands-on projects made all the difference.",
          },
          {
            id: "5",
            name: "Jessica Martinez",
            role: "Frontend Developer at Spotify",
            course: "Full Stack Web Development",
            rating: 4,
            comment:
              "Great course with practical, real-world projects. The community is supportive and the instructors are always available to help.",
          },
          {
            id: "6",
            name: "Ryan Thompson",
            role: "Data Scientist",
            course: "Data Science & Analytics",
            rating: 5,
            comment:
              "The best online learning experience I've had. Clear explanations, practical exercises, and excellent career guidance throughout.",
          },
        ]}
      />

      <IconFeatureGrid
        title="Our mission is to get you into tech. You choose how."
        features={iconFeatures}
      />

      <section className="py-16">
        <div className="container mx-auto px-4">
          <h2 className="text-3xl font-bold text-center mb-12">
            The Key to Your Success: AI-Powered Tools and Unmatched Human
            Support
          </h2>

          <div className="grid md:grid-cols-3 gap-6 max-w-5xl mx-auto">
            <Card className="overflow-hidden" data-testid="card-ai-tools">
              <CardContent className="p-6">
                <div className="h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center mb-4">
                  <img src={rocketIcon} alt="" className="h-6 w-6" />
                </div>
                <h3 className="font-semibold mb-2">AI-Powered Learning</h3>
                <p className="text-sm text-muted-foreground">
                  Personalized curriculum adapts to your pace and learning style
                </p>
              </CardContent>
              <div className="h-1 bg-blue-500" />
            </Card>

            <Card className="overflow-hidden" data-testid="card-mentorship">
              <CardContent className="p-6">
                <div className="h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center mb-4">
                  <img src={communityIcon} alt="" className="h-6 w-6" />
                </div>
                <h3 className="font-semibold mb-2">Expert Mentorship</h3>
                <p className="text-sm text-muted-foreground">
                  1-on-1 guidance from industry professionals with real-world
                  experience
                </p>
              </CardContent>
              <div className="h-1 bg-green-500" />
            </Card>

            <Card className="overflow-hidden" data-testid="card-career-support">
              <CardContent className="p-6">
                <div className="h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center mb-4">
                  <img src={lightningIcon} alt="" className="h-6 w-6" />
                </div>
                <h3 className="font-semibold mb-2">Career Support</h3>
                <p className="text-sm text-muted-foreground">
                  Job placement assistance and interview preparation included
                </p>
              </CardContent>
              <div className="h-1 bg-yellow-500" />
            </Card>
          </div>
        </div>
      </section>

      <ImageTextSection
        title="Making Tech Careers Accessible"
        description="We believe everyone deserves the opportunity to build a career in technology. Our platform removes barriers with flexible learning schedules, affordable pricing options, and comprehensive support from day one to job placement. Whether you're a complete beginner or looking to level up your skills, we're here to guide you every step of the way."
        image={collabImage}
        imagePosition="left"
        ctaText="Start Your Journey"
        onCtaClick={() => {
          setLocation("/learning-paths");
        }}
      />

      <ImageTextSection
        title="Fuel Your Company's Growth with Top Early Talent"
        description="Partner with us to access a pipeline of skilled, job-ready tech professionals. Our graduates are trained in the latest technologies and best practices, ready to contribute from day one. Build your team with passionate developers who bring fresh perspectives and cutting-edge knowledge."
        image={teamImage}
        imagePosition="right"
        ctaText="Partner With Us"
        onCtaClick={() => console.log("Partner clicked")}
      />

      <section className="border-t py-16">
        <div className="container mx-auto px-4">
          <h2 className="text-3xl font-bold text-center mb-12">
            Important Awards and Top Ratings
          </h2>

          <div className="flex flex-wrap justify-center items-center gap-8">
            <div className="text-center">
              <div className="inline-flex items-center gap-1 mb-2">
                {Array.from({ length: 5 }).map((_, i) => (
                  <IconStarFilled key={i} className="w-6 h-6 text-yellow-500" />
                ))}
              </div>
              <p className="text-sm text-muted-foreground">5.0 Course Report</p>
            </div>

            <div className="text-center">
              <div className="inline-flex items-center gap-1 mb-2">
                {Array.from({ length: 5 }).map((_, i) => (
                  <IconStarFilled key={i} className="w-6 h-6 text-yellow-500" />
                ))}
              </div>
              <p className="text-sm text-muted-foreground">4.9 SwitchUp</p>
            </div>

            <div className="text-center">
              <p className="text-lg font-semibold mb-2">Best Coding Bootcamp</p>
              <p className="text-sm text-muted-foreground">2024 Awards</p>
            </div>
          </div>
        </div>
      </section>

      <footer className="bg-muted/30 border-t py-12">
        <div className="container mx-auto px-8 md:px-12">
          <div className="flex flex-wrap justify-between gap-8 mb-8">
            <div>
              <h3 className="font-semibold mb-4">About</h3>
              <ul className="space-y-2 text-sm text-muted-foreground">
                <li>
                  <a href="#" className="hover:text-foreground">
                    Our Story
                  </a>
                </li>
                <li>
                  <a href="#" className="hover:text-foreground">
                    Team
                  </a>
                </li>
                <li>
                  <a href="#" className="hover:text-foreground">
                    Careers
                  </a>
                </li>
              </ul>
            </div>

            <div>
              <h3 className="font-semibold mb-4">Programs</h3>
              <ul className="space-y-2 text-sm text-muted-foreground">
                <li>
                  <a href="#" className="hover:text-foreground">
                    Full Stack
                  </a>
                </li>
                <li>
                  <a href="#" className="hover:text-foreground">
                    Data Science
                  </a>
                </li>
                <li>
                  <a href="#" className="hover:text-foreground">
                    AI & ML
                  </a>
                </li>
              </ul>
            </div>

            <div>
              <h3 className="font-semibold mb-4">Resources</h3>
              <ul className="space-y-2 text-sm text-muted-foreground">
                <li>
                  <a href="#" className="hover:text-foreground">
                    Blog
                  </a>
                </li>
                <li>
                  <a href="#" className="hover:text-foreground">
                    FAQ
                  </a>
                </li>
                <li>
                  <a href="#" className="hover:text-foreground">
                    Support
                  </a>
                </li>
              </ul>
            </div>

            <div>
              <h3 className="font-semibold mb-4">Contact</h3>
              <ul className="space-y-2 text-sm text-muted-foreground">
                <li>hello@aireskill.com</li>
                <li>1-800-RESKILL</li>
              </ul>
            </div>
          </div>

          <div className="border-t pt-8 text-center text-sm text-muted-foreground">
            <p>&copy; 2024 The AI Reskilling Platform. All rights reserved.</p>
          </div>
        </div>
      </footer>
    </div>
  );
}
