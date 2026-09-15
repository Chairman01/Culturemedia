"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { ParticlesBackground } from "@/components/ui/particles";
import { TypingText } from "@/components/ui/typing-text";
import { AnimatedCounter } from "@/components/ui/animated-counter";
import { ContactModal } from "@/components/ui/contact-modal";
import { PhoneModal } from "@/components/ui/phone-modal";
import { CONTACT } from "@/lib/contact";
import { motion } from "framer-motion";
import Link from "next/link";
import {
  ArrowRight,
  ArrowUpRight,
  BarChart3,
  Globe,
  Mail,
  MapPin,
  Megaphone,
  PenTool,
  Phone,
  Rocket,
  Users,
  Camera,
  Search,
  Target,
  TrendingUp,
  Sparkles,
  Lightbulb,
  Zap
} from "lucide-react";
import Image from "next/image";

/**
 * Partners we have published work for. `href` points at the Culture Alberta
 * feature written for them, or the partner's own site where there is no
 * feature. Partners without an `href` have no published story to link to yet.
 */
const PARTNERS = [
  {
    name: "Moveology",
    logo: "/Logos/moveology.png",
    href: "https://www.culturealberta.com/articles/moveology-is-the-calgary-fitness-studio-that-doesnt-feel-like-a-gym",
    linkLabel: "Read the story",
  },
  {
    name: "Tutti Frutti",
    logo: "/Logos/tutti-frutti.png",
    href: "https://www.culturealberta.com/articles/tutti-frutti-breakfast-lunch-is-the-diner-thats-taking-over-edmonton-alberta",
    linkLabel: "Read the story",
  },
  {
    name: "Neon YYC",
    logo: "/Logos/neon-yyc.png",
    href: "https://www.culturealberta.com/articles/neon-yyc-lighting-up-calgary-with-custom-signage",
    linkLabel: "Read the story",
  },
  {
    name: "Pho City",
    logo: "/Logos/pho-city-yyc.png",
    href: "https://www.culturealberta.com/articles/pho-city-is-one-of-the-best-vietnamese-restaurants-in-calgary",
    linkLabel: "Read the story",
  },
  {
    name: "TC Legal",
    logo: "/Logos/tc-legal.png",
    href: "https://www.culturealberta.com/articles/tc-legal-is-the-calgary-law-firm-fighting-for-albertans-after-accidents",
    linkLabel: "Read the story",
  },
  {
    name: "Tire Doctors",
    logo: "/Logos/tiredoctors.png",
    href: "https://www.culturealberta.com/articles/tire-doctors-is-the-calgary-mobile-tire-service-that-comes-to-you",
    linkLabel: "Read the story",
  },
  {
    name: "Sport Calgary",
    logo: "/Logos/sport-calgary.png",
    href: "https://sportcalgary.ca/",
    linkLabel: "Visit site",
  },
  { name: "GameCon Canada", logo: "/Logos/gamecon-canada.png" },
  { name: "PeKKo Chicken", logo: "/Logos/pekko-chicken.png" },
] as const;

const SERVICES = [
  {
    icon: Rocket,
    title: "Digital Growth",
    description:
      "Through data-driven insights and strategic planning, we navigate the evolving digital landscape to build meaningful connections.",
  },
  {
    icon: Globe,
    title: "Web & eCommerce",
    description:
      "We build high-performing websites and online stores that deliver seamless user experiences and drive conversions.",
  },
  {
    icon: Target,
    title: "Digital Strategy",
    description:
      "Our team crafts full-scope marketing strategies and specialized content that motivate action and resonate with customers.",
  },
  {
    icon: PenTool,
    title: "Branding & Identity",
    description:
      "We use strategic thinking and creative design to craft a brand identity that truly represents you.",
  },
  {
    icon: Users,
    title: "Social Media",
    description:
      "We manage your social channels with consistent, engaging content that builds community and increases brand awareness.",
  },
  {
    icon: Camera,
    title: "Video & Photography",
    description:
      "Professional visual content that generates leads, boosts brand awareness, and connects with the next generation.",
  },
  {
    icon: Megaphone,
    title: "Lead Generation",
    description:
      "Strategic campaigns designed to attract, nurture, and convert your ideal customers into loyal clients.",
  },
  {
    icon: Search,
    title: "SEO & Optimization",
    description:
      "Technical SEO and content strategies that improve rankings, drive organic traffic, and increase your visibility.",
  },
] as const;

const BENEFITS = [
  { icon: Zap, title: "Viral Content", description: "Our team crafts share-worthy content that gets your brand noticed" },
  { icon: Target, title: "Targeted Reach", description: "Connect with Calgary & Edmonton's most engaged audiences" },
  { icon: BarChart3, title: "Proven Results", description: "Data-driven campaigns that deliver measurable ROI" },
  { icon: Users, title: "Community Trust", description: "Built on 39K+ followers who trust our recommendations" },
  { icon: Sparkles, title: "Creative Excellence", description: "In-house team dedicated to making your brand shine" },
  { icon: Globe, title: "Local Expertise", description: "Deep understanding of Alberta's culture and trends" },
] as const;

const CAPABILITY_TAGS = [
  { icon: BarChart3, label: "Data-Driven" },
  { icon: Users, label: "Community" },
  { icon: Rocket, label: "Growth" },
  { icon: Target, label: "Strategy" },
  { icon: Globe, label: "Digital" },
  { icon: PenTool, label: "Creative" },
  { icon: Camera, label: "Content" },
  { icon: Megaphone, label: "Marketing" },
  { icon: Search, label: "SEO" },
  { icon: TrendingUp, label: "Analytics" },
  { icon: Sparkles, label: "Innovation" },
  { icon: Lightbulb, label: "Ideas" },
  { icon: Zap, label: "Impact" },
] as const;

const COVERAGE = ["Calgary", "Edmonton", "Red Deer", "Lethbridge", "Medicine Hat", "Grande Prairie"] as const;

const INSTAGRAM_ICON_PATH =
  "M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zm0-2.163c-3.259 0-3.667.014-4.947.072-4.358.2-6.78 2.618-6.98 6.98-.059 1.281-.073 1.689-.073 4.948 0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98 1.281.058 1.689.072 4.948.072 3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98-1.281-.059-1.69-.073-4.949-.073zm0 5.838c-3.403 0-6.162 2.759-6.162 6.162s2.759 6.163 6.162 6.163 6.162-2.759 6.162-6.163c0-3.403-2.759-6.162-6.162-6.162zm0 10.162c-2.209 0-4-1.79-4-4 0-2.209 1.791-4 4-4s4 1.791 4 4c0 2.21-1.791 4-4 4zm6.406-11.845c-.796 0-1.441.645-1.441 1.44s.645 1.44 1.441 1.44c.795 0 1.439-.645 1.439-1.44s-.644-1.44-1.439-1.44z";

function SectionHeading({
  eyebrow,
  title,
  description,
  align = "center",
  className = "",
}: {
  eyebrow: string;
  title: React.ReactNode;
  description?: React.ReactNode;
  align?: "center" | "left";
  className?: string;
}) {
  const isCentered = align === "center";
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true }}
      className={`${isCentered ? "mx-auto max-w-3xl text-center" : "max-w-3xl"} ${className}`}
    >
      <span className="eyebrow">{eyebrow}</span>
      <h2 className="mt-4 text-3xl font-bold tracking-tight text-foreground md:text-5xl">{title}</h2>
      {description && (
        <p className={`mt-5 text-lg leading-relaxed text-muted-foreground ${isCentered ? "mx-auto max-w-2xl" : ""}`}>
          {description}
        </p>
      )}
    </motion.div>
  );
}

export default function Home() {
  const [isContactModalOpen, setIsContactModalOpen] = useState(false);
  const [isPhoneModalOpen, setIsPhoneModalOpen] = useState(false);

  const fadeInUp = {
    initial: { opacity: 0, y: 20 },
    animate: { opacity: 1, y: 0 },
    transition: { duration: 0.5 }
  };

  const staggerContainer = {
    animate: {
      transition: {
        staggerChildren: 0.1
      }
    }
  };

  return (
    <div className="relative flex min-h-screen flex-col bg-white">
      <ParticlesBackground particleColors={['#000000', '#333333', '#666666']} lineColor="0, 0, 0" />
      <ContactModal isOpen={isContactModalOpen} onClose={() => setIsContactModalOpen(false)} />
      <PhoneModal isOpen={isPhoneModalOpen} onClose={() => setIsPhoneModalOpen(false)} />

      {/* ---------------------------------------------------------------- Hero */}
      <section className="relative flex min-h-screen items-center justify-center overflow-hidden px-4 pb-20 pt-32 md:px-6 md:pb-28 md:pt-36">
        <div className="container relative z-10 mx-auto">
          <motion.div
            initial="initial"
            animate="animate"
            variants={staggerContainer}
            className="mx-auto max-w-4xl text-center"
          >
            <motion.div variants={fadeInUp} className="mb-8 flex justify-center">
              <Image
                src="/logo.png"
                alt="Culture Media"
                width={60}
                height={24}
                className="h-auto w-auto object-contain"
                priority
              />
            </motion.div>

            <motion.div
              variants={fadeInUp}
              className="mb-8 inline-block rounded-full border border-gray-200 bg-gray-50/70 px-4 py-1.5 text-xs font-medium text-gray-600 backdrop-blur-md"
            >
              Digital Marketing Agency · Alberta &amp; Canada
            </motion.div>

            <motion.h1
              variants={fadeInUp}
              className="mb-6 text-4xl font-bold leading-[1.1] tracking-tight text-foreground md:text-6xl lg:text-7xl"
            >
              We Help Brands Thrive in
              <br />
              <span className="text-brand">Alberta &amp; Canada</span>
            </motion.h1>

            <motion.p
              variants={fadeInUp}
              className="mx-auto mb-10 max-w-2xl text-lg leading-relaxed text-muted-foreground md:text-xl"
            >
              Your strategic partner for digital transformation. We craft tailored marketing solutions
              that drive measurable growth and build lasting relationships.
            </motion.p>

            <motion.div variants={fadeInUp} className="flex flex-col items-center justify-center gap-4 sm:flex-row">
              <Button size="lg" className="group w-full sm:w-auto" onClick={() => setIsContactModalOpen(true)}>
                Start a Partnership
                <ArrowRight className="ml-2 h-4 w-4 transition-transform group-hover:translate-x-1" />
              </Button>
              <Link href="#services" className="w-full sm:w-auto">
                <Button
                  variant="outline"
                  size="lg"
                  className="w-full border-gray-300 text-gray-700 hover:bg-gray-50 sm:w-auto"
                >
                  Explore Services
                </Button>
              </Link>
            </motion.div>

            <motion.div
              variants={fadeInUp}
              className="mt-20 grid grid-cols-1 gap-10 border-t border-gray-200 pt-10 sm:grid-cols-3 sm:gap-8"
            >
              <div>
                <AnimatedCounter end={300000} suffix="+" className="text-3xl font-bold text-foreground md:text-4xl" />
                <div className="mt-1 text-sm text-muted-foreground">Community Reach</div>
              </div>
              <div>
                <AnimatedCounter end={1000000} suffix="+" className="text-3xl font-bold text-foreground md:text-4xl" />
                <div className="mt-1 text-sm text-muted-foreground">Monthly Impressions</div>
              </div>
              <div>
                <AnimatedCounter end={100} suffix="+" className="text-3xl font-bold text-foreground md:text-4xl" />
                <div className="mt-1 text-sm text-muted-foreground">Campaigns Delivered</div>
              </div>
            </motion.div>
          </motion.div>
        </div>
      </section>

      {/* ------------------------------------------------------- About / value */}
      <section id="about" className="relative overflow-hidden bg-white px-4 py-20 md:px-6 md:py-28">
        <div className="container mx-auto">
          <SectionHeading
            align="left"
            eyebrow="Who we are"
            title={
              <>
                Culture Media is your growth engine for the Alberta market,{" "}
                <TypingText
                  text="transforming brands into community leaders."
                  speed={75}
                  className="text-brand"
                />
              </>
            }
          />

          <div className="mt-14 flex flex-wrap items-center justify-center gap-3 md:justify-start md:gap-4">
            {CAPABILITY_TAGS.map((item, index) => {
              const Icon = item.icon;
              return (
                <motion.div
                  key={item.label}
                  initial={{ opacity: 0, y: 12 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{ delay: index * 0.04 }}
                  whileHover={{ scale: 1.06, y: -4 }}
                  className="group"
                >
                  <div className="flex cursor-default flex-col items-center gap-2 rounded-2xl border border-gray-200 bg-gray-50 p-4 transition-colors hover:border-gray-300 hover:bg-white md:p-5">
                    <Icon className="h-6 w-6 text-gray-700 transition-colors group-hover:text-primary md:h-7 md:w-7" />
                    <span className="text-[11px] font-medium text-gray-500 transition-colors group-hover:text-gray-900">
                      {item.label}
                    </span>
                  </div>
                </motion.div>
              );
            })}
          </div>
        </div>
      </section>

      {/* --------------------------------------------------------- Partners */}
      <section id="partners" className="relative bg-gray-50 px-4 py-20 md:px-6 md:py-28">
        <div className="container mx-auto">
          <div className="mx-auto grid max-w-6xl items-start gap-12 lg:grid-cols-2 lg:gap-16">
            {/* Left — copy */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              className="lg:sticky lg:top-28"
            >
              <span className="eyebrow">Our partners</span>
              <h2 className="mt-4 text-3xl font-bold tracking-tight text-foreground md:text-5xl">
                Trusted by <span className="text-primary">local businesses</span> across Alberta
              </h2>
              <p className="mt-5 text-lg leading-relaxed text-muted-foreground">
                From restaurants to retailers, we help Alberta businesses connect with their community
                through authentic storytelling and strategic content placement.
              </p>

              <ul className="mt-8 space-y-4">
                {[
                  "Authentic content that resonates locally",
                  "Instagram, newsletter and web coverage",
                  "Real engagement from real Albertans",
                ].map((item) => (
                  <li key={item} className="flex items-start gap-3">
                    <span className="mt-0.5 flex h-5 w-5 flex-shrink-0 items-center justify-center rounded-full bg-green-500">
                      <svg className="h-3 w-3 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                      </svg>
                    </span>
                    <span className="text-foreground">{item}</span>
                  </li>
                ))}
              </ul>

              <Button onClick={() => setIsContactModalOpen(true)} className="group mt-8">
                Partner With Us
                <ArrowRight className="ml-2 h-4 w-4 transition-transform group-hover:translate-x-1" />
              </Button>
            </motion.div>

            {/* Right — partner cards */}
            <div>
              <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
                {PARTNERS.map((partner, index) => {
                  const href = "href" in partner ? partner.href : undefined;
                  const linkLabel = "linkLabel" in partner ? partner.linkLabel : undefined;

                  const inner = (
                    <>
                      {/* Affordance for the clickable cards: a corner arrow on hover,
                          rather than a text label under every logo. */}
                      {href && (
                        <ArrowUpRight className="pointer-events-none absolute right-2 top-2 h-3.5 w-3.5 text-primary opacity-0 transition-opacity duration-300 group-hover:opacity-100" />
                      )}
                      <div className="flex flex-1 items-center justify-center p-5">
                        <Image
                          src={partner.logo}
                          alt={`${partner.name} logo`}
                          width={120}
                          height={120}
                          className="max-h-20 w-full object-contain"
                        />
                      </div>
                      <div className="border-t border-gray-100 px-3 py-2.5 text-center">
                        <div className="truncate text-xs font-semibold text-foreground">{partner.name}</div>
                      </div>
                    </>
                  );

                  const cardClass =
                    "group relative flex h-full flex-col overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm transition-all duration-300 hover:-translate-y-1 hover:border-primary/40 hover:shadow-xl";

                  return (
                    <motion.div
                      key={partner.name}
                      initial={{ opacity: 0, scale: 0.92 }}
                      whileInView={{ opacity: 1, scale: 1 }}
                      viewport={{ once: true }}
                      transition={{ delay: index * 0.05 }}
                    >
                      {href ? (
                        <a
                          href={href}
                          target="_blank"
                          rel="noopener noreferrer"
                          aria-label={`${partner.name} — ${linkLabel}`}
                          className={cardClass}
                        >
                          {inner}
                        </a>
                      ) : (
                        <div className={cardClass}>{inner}</div>
                      )}
                    </motion.div>
                  );
                })}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* -------------------------------------------------- Hyper-local reach */}
      <section className="relative bg-white px-4 py-20 md:px-6 md:py-28">
        <div className="container mx-auto">
          <SectionHeading
            eyebrow="Coverage"
            title="Hyper-Local Coverage"
            description="We know Alberta inside and out — and we publish where its communities are already reading."
          />

          <div className="mt-12 flex flex-wrap items-center justify-center gap-3">
            {COVERAGE.map((city, index) => (
              <motion.span
                key={city}
                initial={{ opacity: 0, scale: 0.9 }}
                whileInView={{ opacity: 1, scale: 1 }}
                viewport={{ once: true }}
                transition={{ delay: index * 0.06 }}
                whileHover={{ scale: 1.05 }}
                className="cursor-default rounded-full border border-gray-200 bg-gray-50 px-6 py-2.5 text-sm font-semibold uppercase tracking-wide text-gray-700 shadow-sm transition-colors hover:border-primary/40 hover:bg-white hover:text-primary"
              >
                {city}
              </motion.span>
            ))}
          </div>
        </div>
      </section>

      {/* ---------------------------------------------------------- Services */}
      <section id="services" className="relative bg-gray-50 px-4 py-20 md:px-6 md:py-28">
        <div className="container mx-auto">
          <SectionHeading
            eyebrow="What we do"
            title="Strategies That Drive Results"
            description="Strategic services designed to accelerate your growth and build lasting market presence."
          />

          <div className="mt-14 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
            {SERVICES.map((service, index) => {
              const Icon = service.icon;
              return (
                <motion.div
                  key={service.title}
                  initial={{ opacity: 0, y: 20 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{ delay: (index % 4) * 0.08 }}
                >
                  <Card className="h-full border-gray-200 bg-white p-7 transition-all duration-300 hover:-translate-y-1 hover:border-primary/30 hover:shadow-lg">
                    <div className="mb-6 inline-flex rounded-xl bg-blue-50 p-3">
                      <Icon className="h-6 w-6 text-primary" />
                    </div>
                    <h3 className="mb-3 text-lg font-bold text-foreground">{service.title}</h3>
                    <p className="text-sm leading-relaxed text-muted-foreground">{service.description}</p>
                  </Card>
                </motion.div>
              );
            })}
          </div>
        </div>
      </section>

      {/* -------------------------------------------- Growth partner + media */}
      <section id="platforms" className="relative bg-white px-4 py-20 md:px-6 md:py-28">
        <div className="container mx-auto">
          <div className="grid items-start gap-12 lg:grid-cols-2 lg:gap-16">
            {/* Left */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
            >
              <span className="eyebrow">Why us</span>
              <h2 className="mt-4 text-3xl font-bold tracking-tight text-foreground md:text-5xl">
                Your Strategic <span className="text-brand">Growth Partner</span>
              </h2>
              <div className="mt-5 space-y-4 text-lg leading-relaxed text-muted-foreground">
                <p>
                  Culture Media is a full-service digital marketing agency specializing in the Alberta and
                  Canadian markets. We&apos;ve helped countless brands transform their digital presence and
                  achieve sustainable growth.
                </p>
                <p>
                  Our approach is built on partnership, not transactions. We work primarily with retainer
                  clients because we believe the best results come from deep collaboration and continuous
                  optimization over time.
                </p>
              </div>

              <div className="mt-12">
                <h3 className="text-xl font-bold text-foreground">Why Partner With Us?</h3>
                <div className="mt-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
                  {BENEFITS.map((benefit, index) => {
                    const Icon = benefit.icon;
                    return (
                      <motion.div
                        key={benefit.title}
                        initial={{ opacity: 0, y: 16 }}
                        whileInView={{ opacity: 1, y: 0 }}
                        viewport={{ once: true }}
                        transition={{ delay: index * 0.06 }}
                      >
                        <Card className="h-full border-gray-200 bg-white p-5 transition-all duration-300 hover:-translate-y-1 hover:shadow-lg">
                          <div className="mb-3 inline-flex rounded-lg bg-blue-50 p-2">
                            <Icon className="h-4 w-4 text-primary" />
                          </div>
                          <h4 className="mb-1.5 text-sm font-bold text-foreground">{benefit.title}</h4>
                          <p className="text-xs leading-relaxed text-muted-foreground">{benefit.description}</p>
                        </Card>
                      </motion.div>
                    );
                  })}
                </div>
              </div>
            </motion.div>

            {/* Right — media platforms */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              className="rounded-2xl border border-gray-200 bg-white p-6 shadow-xl md:p-8 lg:sticky lg:top-28"
            >
              <div className="text-center">
                <span className="eyebrow">Owned media</span>
                <h3 className="mt-3 text-2xl font-bold text-foreground">Our Media Platforms</h3>
                <p className="mx-auto mt-2 max-w-sm text-sm text-muted-foreground">
                  Proprietary channels reaching Alberta&apos;s most engaged audiences.
                </p>
              </div>

              <div className="mt-6 rounded-xl border-2 border-blue-100 bg-blue-50/60 p-4">
                <div className="flex items-center gap-3">
                  <span className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full bg-primary text-white">
                    <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                  </span>
                  <div className="text-left">
                    <div className="text-sm font-bold text-blue-900">Free Platform Access</div>
                    <div className="text-xs text-blue-700">
                      Get featured across all our platforms when you partner with us
                    </div>
                  </div>
                </div>
              </div>

              <div className="mt-6 overflow-hidden rounded-xl border border-gray-200">
                <Image
                  src="/our-media-platforms.png"
                  alt="Culture Media platforms — Instagram, website, and newsletter"
                  width={1200}
                  height={600}
                  className="h-auto w-full"
                  priority
                />
              </div>

              <div className="mt-6 space-y-5">
                <div>
                  <h4 className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
                    Instagram
                  </h4>
                  <div className="mt-2 grid grid-cols-1 gap-2 sm:grid-cols-2">
                    <a
                      href={CONTACT.instagram.alberta}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-2 rounded-lg border border-gray-200 bg-white px-3 py-2.5 transition-all duration-300 hover:-translate-y-0.5 hover:border-primary/40 hover:shadow-md"
                    >
                      <svg className="h-4 w-4 flex-shrink-0 text-gray-700" fill="currentColor" viewBox="0 0 24 24">
                        <path d={INSTAGRAM_ICON_PATH} />
                      </svg>
                      <span className="min-w-0 text-left">
                        <span className="block truncate text-xs font-bold text-foreground">@culturealberta._</span>
                        <span className="block text-[10px] text-muted-foreground">19K followers</span>
                      </span>
                    </a>
                    <a
                      href={CONTACT.instagram.calgary}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-2 rounded-lg border border-gray-200 bg-white px-3 py-2.5 transition-all duration-300 hover:-translate-y-0.5 hover:border-primary/40 hover:shadow-md"
                    >
                      <svg className="h-4 w-4 flex-shrink-0 text-gray-700" fill="currentColor" viewBox="0 0 24 24">
                        <path d={INSTAGRAM_ICON_PATH} />
                      </svg>
                      <span className="min-w-0 text-left">
                        <span className="block truncate text-xs font-bold text-foreground">@cultureyyc._</span>
                        <span className="block text-[10px] text-muted-foreground">20.8K followers</span>
                      </span>
                    </a>
                  </div>
                </div>

                <div>
                  <h4 className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
                    Website &amp; Newsletter
                  </h4>
                  <div className="mt-2 grid grid-cols-1 gap-2 sm:grid-cols-2">
                    <a
                      href={CONTACT.publication}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-2 rounded-lg border border-gray-200 bg-white px-3 py-2.5 transition-all duration-300 hover:-translate-y-0.5 hover:border-primary/40 hover:shadow-md"
                    >
                      <Globe className="h-4 w-4 flex-shrink-0 text-gray-700" />
                      <span className="min-w-0 text-left">
                        <span className="block truncate text-xs font-bold text-foreground">culturealberta.com</span>
                        <span className="block text-[10px] text-muted-foreground">60K+ monthly views</span>
                      </span>
                    </a>
                    <a
                      href={CONTACT.publication}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-2 rounded-lg border border-gray-200 bg-white px-3 py-2.5 transition-all duration-300 hover:-translate-y-0.5 hover:border-primary/40 hover:shadow-md"
                    >
                      <Mail className="h-4 w-4 flex-shrink-0 text-gray-700" />
                      <span className="min-w-0 text-left">
                        <span className="block truncate text-xs font-bold text-foreground">Newsletter</span>
                        <span className="block text-[10px] text-muted-foreground">2,500+ subscribers</span>
                      </span>
                    </a>
                  </div>
                </div>
              </div>
            </motion.div>
          </div>
        </div>
      </section>

      {/* ------------------------------------------------------------- Contact */}
      <section id="contact" className="relative overflow-hidden bg-black px-4 py-20 md:px-6 md:py-28">
        <ParticlesBackground
          className="absolute inset-0 z-0"
          particleColors={['#3b82f6', '#60a5fa', '#93c5fd']}
          lineColor="59, 130, 246"
        />

        <div className="container relative z-10 mx-auto">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="mx-auto max-w-3xl text-center"
          >
            <span className="eyebrow text-blue-400">Get in touch</span>
            <h2 className="mt-4 text-4xl font-bold tracking-tight text-white md:text-6xl">
              <TypingText text="Start Your Partnership" speed={75} />
            </h2>
            <p className="mt-5 text-lg text-gray-400">
              Let&apos;s build a long-term relationship that drives measurable growth for your brand.
            </p>
          </motion.div>

          <div className="mx-auto mt-16 grid max-w-6xl gap-6 lg:grid-cols-2 lg:gap-8">
            {/* Contact details */}
            <div className="space-y-4">
              {[
                { icon: Mail, label: "Email", value: CONTACT.email, href: `mailto:${CONTACT.email}` },
                { icon: Phone, label: "Phone", value: CONTACT.phoneDisplay, href: `tel:${CONTACT.phoneHref}` },
                { icon: MapPin, label: "Location", value: CONTACT.locationLine, secondary: CONTACT.country },
              ].map((item, index) => {
                const Icon = item.icon;
                const body = (
                  <Card className="border-2 border-gray-800 bg-black/50 p-6 transition-all hover:border-blue-500/50 hover:bg-gray-900/50">
                    <div className="flex items-start gap-4">
                      <span className="rounded-lg bg-gray-900 p-3 transition-colors group-hover:bg-blue-900/30">
                        <Icon className="h-5 w-5 text-white" />
                      </span>
                      <div className="min-w-0">
                        <h3 className="text-xs font-semibold uppercase tracking-widest text-gray-400">{item.label}</h3>
                        <p className="mt-1.5 break-words text-lg font-medium text-white">{item.value}</p>
                        {item.secondary && <p className="text-gray-400">{item.secondary}</p>}
                      </div>
                    </div>
                  </Card>
                );

                return (
                  <motion.div
                    key={item.label}
                    initial={{ opacity: 0, x: -20 }}
                    whileInView={{ opacity: 1, x: 0 }}
                    viewport={{ once: true }}
                    transition={{ delay: index * 0.1 }}
                  >
                    {item.href ? (
                      <a href={item.href} className="group block">
                        {body}
                      </a>
                    ) : (
                      <div className="group">{body}</div>
                    )}
                  </motion.div>
                );
              })}
            </div>

            {/* CTA card */}
            <motion.div
              initial={{ opacity: 0, x: 20 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true }}
              className="relative overflow-hidden rounded-2xl border border-gray-800 bg-gradient-to-br from-gray-900 to-black p-8 text-white shadow-2xl md:p-10"
            >
              <div className="pointer-events-none absolute right-0 top-0 h-64 w-64 rounded-full bg-blue-500/10 blur-[80px]" />

              <h3 className="relative z-10 text-2xl font-bold md:text-3xl">Ready to Grow Together?</h3>
              <p className="relative z-10 mt-5 leading-relaxed text-gray-300">
                We&apos;re selective about our partnerships because we&apos;re committed to delivering exceptional
                results. If you&apos;re ready to invest in your brand&apos;s growth with a dedicated partner,
                let&apos;s talk.
              </p>

              <ul className="relative z-10 mt-8 space-y-4">
                {[
                  { title: "Free Strategy Session:", body: " Discuss your goals and challenges with our team" },
                  { title: "Custom Proposals:", body: " Tailored strategies and transparent pricing" },
                  { title: "Retainer Programs:", body: " Flexible partnership models built for long-term success" },
                ].map((item) => (
                  <li key={item.title} className="flex items-start gap-3">
                    <span className="mt-1 text-primary">•</span>
                    <p>
                      <span className="font-bold text-white">{item.title}</span>
                      <span className="text-gray-300">{item.body}</span>
                    </p>
                  </li>
                ))}
              </ul>

              <div className="relative z-10 mt-10 flex flex-col gap-3 sm:flex-row">
                <Button
                  size="lg"
                  className="flex-1 bg-white text-black hover:bg-gray-200"
                  onClick={() => setIsContactModalOpen(true)}
                >
                  Get in Touch
                </Button>
                <Button
                  variant="outline"
                  size="lg"
                  className="flex-1 border-gray-700 text-white hover:bg-white/10"
                  onClick={() => setIsPhoneModalOpen(true)}
                >
                  Call Us
                </Button>
              </div>
            </motion.div>
          </div>
        </div>
      </section>
    </div>
  );
}
