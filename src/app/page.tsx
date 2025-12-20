"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { ParticlesBackground } from "@/components/ui/particles";
import { TypingText } from "@/components/ui/typing-text";
import { ContactModal } from "@/components/ui/contact-modal";
import { PhoneModal } from "@/components/ui/phone-modal";
import { motion } from "framer-motion";
import Link from "next/link";
import {
  ArrowRight,
  BarChart3,
  Globe,
  Megaphone,
  PenTool,
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

  const float = {
    initial: { y: 0 },
    animate: {
      y: [0, -10, 0],
      transition: {
        duration: 3,
        repeat: Infinity,
        ease: "easeInOut"
      }
    }
  };

  return (
    <div className="flex flex-col min-h-screen relative bg-white">
      <ParticlesBackground particleColors={['#000000', '#333333', '#666666']} lineColor="0, 0, 0" />
      <ContactModal isOpen={isContactModalOpen} onClose={() => setIsContactModalOpen(false)} />
      <PhoneModal isOpen={isPhoneModalOpen} onClose={() => setIsPhoneModalOpen(false)} />

      {/* Hero Section */}
      <section className="relative flex min-h-screen items-center justify-center overflow-hidden pt-20">

        <div className="container mx-auto relative z-10 px-4 md:px-6">
          <motion.div
            initial="initial"
            animate="animate"
            variants={staggerContainer}
            className="mx-auto max-w-4xl text-center"
          >
            <motion.div
              variants={fadeInUp}
              animate={{
                y: [0, -8, 0],
                transition: {
                  duration: 2.5,
                  repeat: Infinity,
                  ease: "easeInOut"
                }
              }}
              className="mb-6 flex justify-center"
            >
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
              animate={{
                y: [0, -5, 0],
                transition: {
                  duration: 3,
                  repeat: Infinity,
                  ease: "easeInOut",
                  delay: 0.2
                }
              }}
              className="mb-6 inline-block rounded-full border border-gray-200 bg-gray-50/50 px-4 py-1.5 text-xs font-medium text-gray-600 backdrop-blur-md"
            >
              Digital Marketing Agency | Alberta & Canada
            </motion.div>

            <motion.h1
              variants={fadeInUp}
              animate={{
                y: [0, -6, 0],
                transition: {
                  duration: 3.5,
                  repeat: Infinity,
                  ease: "easeInOut",
                  delay: 0.4
                }
              }}
              className="mb-6 text-4xl font-bold tracking-tight md:text-6xl lg:text-7xl text-foreground"
            >
              We Help Brands Thrive in <br />
              <span className="text-[#808080]">Alberta & Canada</span>
            </motion.h1>

            <motion.p variants={fadeInUp} className="mb-10 text-lg text-muted-foreground md:text-xl max-w-2xl mx-auto">
              Your strategic partner for digital transformation. We craft tailored marketing solutions that drive measurable growth and build lasting relationships.
            </motion.p>

            <motion.div variants={fadeInUp} className="flex flex-col items-center justify-center gap-4 sm:flex-row">
              <Button size="lg" className="group" onClick={() => setIsContactModalOpen(true)}>
                Start a Partnership
                <ArrowRight className="ml-2 h-4 w-4 transition-transform group-hover:translate-x-1" />
              </Button>
              <Link href="#services">
                <Button variant="outline" size="lg" className="border-gray-200 text-gray-700 hover:bg-gray-50">
                  Explore Services
                </Button>
              </Link>
            </motion.div>

            {/* Trusted By / Stats Preview */}
            <motion.div variants={fadeInUp} className="mt-16 grid grid-cols-2 gap-8 md:grid-cols-4 border-t border-gray-200 pt-8">
              <div>
                <div className="text-3xl font-bold text-foreground">380K+</div>
                <div className="text-sm text-muted-foreground">Community Reach</div>
              </div>
              <div>
                <div className="text-3xl font-bold text-foreground">700K+</div>
                <div className="text-sm text-muted-foreground">Monthly Impressions</div>
              </div>
              <div>
                <div className="text-3xl font-bold text-foreground">100+</div>
                <div className="text-sm text-muted-foreground">Campaigns Delivered</div>
              </div>
              <div>
                <div className="text-3xl font-bold text-foreground">50+</div>
                <div className="text-sm text-muted-foreground">Active Partners</div>
              </div>
            </motion.div>
          </motion.div>
        </div>
      </section>

      {/* Value Proposition Section - Antigravity Inspired */}
      <section id="platforms" className="relative py-32 overflow-hidden bg-white">
        <div className="container mx-auto px-4 md:px-6">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="max-w-3xl mb-20"
          >
            <h2 className="text-4xl md:text-5xl font-bold text-foreground leading-tight">
              Culture Media is your growth engine for the Alberta market,{" "}
              <TypingText
                text="transforming brands into community leaders."
                speed={75}
                className="text-[#808080]"
              />
            </h2>
          </motion.div>

          {/* Floating Icons Grid */}
          <div className="flex flex-wrap gap-4 items-center justify-center md:justify-start">
            {[
              { icon: BarChart3, label: "Data-Driven", delay: 0 },
              { icon: Users, label: "Community", delay: 0.1 },
              { icon: Rocket, label: "Growth", delay: 0.2 },
              { icon: Target, label: "Strategy", delay: 0.3 },
              { icon: Globe, label: "Digital", delay: 0.4 },
              { icon: PenTool, label: "Creative", delay: 0.5 },
              { icon: Camera, label: "Content", delay: 0.6 },
              { icon: Megaphone, label: "Marketing", delay: 0.7 },
              { icon: Search, label: "SEO", delay: 0.8 },
              { icon: TrendingUp, label: "Analytics", delay: 0.9 },
              { icon: Sparkles, label: "Innovation", delay: 1.0 },
              { icon: Lightbulb, label: "Ideas", delay: 1.1 },
              { icon: Zap, label: "Impact", delay: 1.2 }
            ].map((item, index) => {
              const Icon = item.icon;
              return (
                <motion.div
                  key={index}
                  animate={{
                    y: [0, -20, 0],
                  }}
                  transition={{
                    duration: 2.5 + index * 0.2,
                    repeat: Infinity,
                    ease: "easeInOut",
                    delay: item.delay
                  }}
                  whileHover={{ scale: 1.15, y: -8 }}
                  className="group"
                >
                  <div className="relative">
                    <div className="bg-gray-50 hover:bg-gray-100 border border-gray-200 rounded-2xl p-6 transition-all cursor-pointer">
                      <Icon className="h-8 w-8 text-gray-700" />
                    </div>
                    <div className="absolute -bottom-8 left-1/2 -translate-x-1/2 opacity-0 group-hover:opacity-100 transition-opacity">
                      <span className="text-xs font-medium text-gray-600 whitespace-nowrap">{item.label}</span>
                    </div>
                  </div>
                </motion.div>
              );
            })}
          </div>
        </div>
      </section>

      {/* Partners Section */}
      <section className="relative py-24 bg-white">
        <div className="container mx-auto px-4 md:px-6">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="max-w-6xl mx-auto"
          >
            <div className="grid lg:grid-cols-2 gap-12 items-center">
              {/* Left - Text Content */}
              <div>
                <h2 className="text-4xl md:text-5xl font-bold mb-6">
                  Trusted by <span className="text-blue-600">local businesses</span> across Alberta
                </h2>
                <p className="text-muted-foreground text-lg mb-6">
                  From restaurants to retailers, we help Alberta businesses connect with their community through authentic storytelling and strategic content placement.
                </p>
                <ul className="space-y-3 mb-8">
                  {[
                    "Authentic content that resonates locally",
                    "Instagram, YouTube, Newsletter & Web",
                    "Real engagement from real Albertans"
                  ].map((item, i) => (
                    <li key={i} className="flex items-center gap-3">
                      <div className="h-5 w-5 rounded-full bg-green-500 flex items-center justify-center flex-shrink-0">
                        <svg className="w-3 h-3 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                        </svg>
                      </div>
                      <span className="text-foreground">{item}</span>
                    </li>
                  ))}
                </ul>
                <Button onClick={() => setIsContactModalOpen(true)} className="group">
                  Partner With Us!
                  <ArrowRight className="ml-2 h-4 w-4 transition-transform group-hover:translate-x-1" />
                </Button>
              </div>

              {/* Right - Partner Logos Grid */}
              <div>
                <div className="grid grid-cols-3 gap-4">
                  {[
                    { name: "Moveology", logo: "/Logos/moveology.png" },
                    { name: "Tutti Frutti", logo: "/Logos/tutti-frutti.png" },
                    { name: "Neon YYC", logo: "/Logos/neon-yyc.png" },
                    { name: "Pho City", logo: "/Logos/pho-city-yyc.png" },
                    { name: "YC Legal", logo: "/Logos/tc-legal.png" },
                    { name: "Start Calgary", logo: "/Logos/sport-calgary.png" },
                    { name: "GameCon Canada", logo: "/Logos/gamecon-canada.png" },
                    { name: "PeKKo", logo: "/Logos/pekko-chicken.png" },
                    { name: "Tire Doctors", logo: "/Logos/tiredoctors.png" }
                  ].map((partner, index) => (
                    <motion.div
                      key={index}
                      initial={{ opacity: 0, scale: 0.8 }}
                      whileInView={{ opacity: 1, scale: 1 }}
                      viewport={{ once: true }}
                      transition={{ delay: index * 0.05 }}
                      whileHover={{ scale: 1.05, y: -4 }}
                      className="group cursor-pointer"
                    >
                      <div className="bg-white border border-gray-200 aspect-square rounded-xl flex items-center justify-center p-6 shadow-md hover:shadow-xl transition-all">
                        <Image
                          src={partner.logo}
                          alt={partner.name}
                          width={120}
                          height={120}
                          className="object-contain w-full h-full"
                        />
                      </div>
                    </motion.div>
                  ))}
                </div>
              </div>
            </div>
          </motion.div>
        </div>
      </section>

      {/* Services Section */}
      <section id="services" className="relative py-24 md:py-32">
        <div className="container mx-auto px-4 md:px-6">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="mb-16 text-center"
          >
            <h2 className="mb-4 text-3xl font-bold md:text-5xl text-foreground">Strategies That Drive Results</h2>
            <p className="mx-auto max-w-2xl text-muted-foreground">
              We've got this. Strategic services designed to accelerate your growth and build lasting market presence.
            </p>
          </motion.div>

          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
            {[
              {
                icon: <Rocket className="h-8 w-8 text-blue-600" />,
                title: "Digital Growth",
                description: "Through data-driven insights and strategic planning, we navigate the evolving digital landscape to build meaningful connections."
              },
              {
                icon: <Globe className="h-8 w-8 text-purple-600" />,
                title: "Web & eCommerce",
                description: "We build high-performing websites and online stores that deliver seamless user experiences and drive conversions."
              },
              {
                icon: <Target className="h-8 w-8 text-pink-600" />,
                title: "Digital Strategy",
                description: "Our team crafts full-scope marketing strategies and specialized content that motivate action and resonate with customers."
              },
              {
                icon: <PenTool className="h-8 w-8 text-blue-500" />,
                title: "Branding & Identity",
                description: "We use strategic thinking and creative design to craft a brand identity that truly represents you."
              },
              {
                icon: <Users className="h-8 w-8 text-purple-500" />,
                title: "Social Media",
                description: "We manage your social channels with consistent, engaging content that builds community and increases brand awareness."
              },
              {
                icon: <Camera className="h-8 w-8 text-pink-500" />,
                title: "Video & Photography",
                description: "Professional visual content that generates leads, boosts brand awareness, and connects with the next generation."
              },
              {
                icon: <Megaphone className="h-8 w-8 text-blue-400" />,
                title: "Lead Generation",
                description: "Strategic campaigns designed to attract, nurture, and convert your ideal customers into loyal clients."
              },
              {
                icon: <Search className="h-8 w-8 text-purple-400" />,
                title: "SEO & Optimization",
                description: "Technical SEO and content strategies that improve rankings, drive organic traffic, and increase your visibility."
              }
            ].map((service, index) => (
              <motion.div
                key={index}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: index * 0.1 }}
              >
                <Card className="h-full border-gray-100 bg-white/50 hover:bg-white hover:shadow-lg transition-all duration-300">
                  <div className="mb-6 inline-block rounded-lg bg-blue-50 p-3">
                    {service.icon}
                  </div>
                  <h3 className="mb-3 text-xl font-bold text-foreground">{service.title}</h3>
                  <p className="text-sm text-muted-foreground leading-relaxed">{service.description}</p>
                </Card>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* Why Us Section */}
      <section id="about" className="relative py-24 bg-gray-50/50">
        <div className="container mx-auto px-4 md:px-6">
          <div className="grid gap-12 lg:grid-cols-2 items-center">
            <motion.div
              initial={{ opacity: 0, x: -50 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true }}
            >
              <h2 className="mb-6 text-3xl font-bold md:text-5xl text-foreground">
                Your Strategic <span className="text-[#808080]">Growth Partner</span>
              </h2>
              <div className="space-y-6 text-lg text-muted-foreground">
                <p>
                  Culture Media is a full-service digital marketing agency specializing in the Alberta and Canadian markets. We've helped countless brands transform their digital presence and achieve sustainable growth.
                </p>
                <p>
                  Our approach is built on partnership, not transactions. We work primarily with retainer clients because we believe the best results come from deep collaboration and continuous optimization over time.
                </p>
                <div className="pt-4">
                  <h3 className="text-foreground font-bold mb-4">Why Partner With Us?</h3>
                  <ul className="space-y-4">
                    {[
                      "Local Expertise: Deep understanding of Alberta markets.",
                      "Full-Service Solutions: From strategy to execution.",
                      "Dedicated Partnership: Invested in your long-term success."
                    ].map((item, i) => (
                      <li key={i} className="flex items-center gap-3">
                        <div className="h-2 w-2 rounded-full bg-[#808080]" />
                        <span className="text-foreground">{item}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, scale: 0.8 }}
              whileInView={{ opacity: 1, scale: 1 }}
              viewport={{ once: true }}
              className="relative aspect-square rounded-2xl bg-white p-8 shadow-xl border border-gray-100 flex flex-col justify-center"
            >
              <div className="text-center mb-8">
                <h3 className="text-2xl font-bold text-foreground mb-2">Our Media Platforms</h3>
                <p className="text-muted-foreground">Proprietary channels reaching Alberta's most engaged audiences</p>
              </div>

              <div className="grid grid-cols-1 gap-6">
                <div className="bg-gray-50 p-6 rounded-xl border border-gray-100">
                  <div className="flex justify-between items-center mb-2">
                    <span className="font-bold text-foreground">Culture Alberta</span>
                    <span className="text-gray-600 text-sm">@culturealberta</span>
                  </div>
                  <div className="text-3xl font-bold text-foreground mb-1">290K+</div>
                  <div className="text-sm text-muted-foreground">Community Followers</div>
                </div>

                <div className="bg-gray-50 p-6 rounded-xl border border-gray-100">
                  <div className="flex justify-between items-center mb-2">
                    <span className="font-bold text-foreground">Culture YYC</span>
                    <span className="text-gray-600 text-sm">@cultureyyc</span>
                  </div>
                  <div className="text-3xl font-bold text-foreground mb-1">90K+</div>
                  <div className="text-sm text-muted-foreground">Community Followers</div>
                </div>
              </div>
            </motion.div>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section id="contact" className="relative py-24 md:py-32 bg-black overflow-hidden">
        <ParticlesBackground
          className="absolute inset-0 z-0"
          particleColors={['#3b82f6', '#60a5fa', '#93c5fd']} // Blue shades
          lineColor="59, 130, 246" // Blue RGB
        />

        <div className="container mx-auto relative z-10 px-4 md:px-6">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="text-center mb-16"
          >
            <h2 className="mb-4 text-4xl font-bold tracking-tight md:text-6xl lg:text-7xl text-white">
              <TypingText text="Start Your Partnership" speed={75} />
            </h2>
            <p className="text-lg text-gray-400">
              Let's build a long-term relationship that drives measurable growth for your brand.
            </p>
          </motion.div>

          <div className="grid gap-8 lg:grid-cols-2 max-w-6xl mx-auto">
            {/* Left Column - Contact Cards */}
            <div className="space-y-6">
              {/* Email Card */}
              <motion.a
                href="mailto:culturemedia101@gmail.com"
                initial={{ opacity: 0, x: -20 }}
                whileInView={{ opacity: 1, x: 0 }}
                viewport={{ once: true }}
                className="block"
              >
                <Card className="p-6 border-2 border-gray-800 bg-black/50 hover:bg-gray-900/50 hover:border-blue-500/50 transition-all group">
                  <div className="flex items-start gap-4">
                    <div className="bg-gray-900 p-3 rounded group-hover:bg-blue-900/20 transition-colors">
                      <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                      </svg>
                    </div>
                    <div>
                      <h3 className="text-lg font-bold text-white mb-2">Email</h3>
                      <p className="text-gray-200 group-hover:text-white transition-colors">culturemedia101@gmail.com</p>
                    </div>
                  </div>
                </Card>
              </motion.a>

              {/* Phone Card */}
              <motion.a
                href="tel:2262361828"
                initial={{ opacity: 0, x: -20 }}
                whileInView={{ opacity: 1, x: 0 }}
                viewport={{ once: true }}
                transition={{ delay: 0.1 }}
                className="block"
              >
                <Card className="p-6 border-2 border-gray-800 bg-black/50 hover:bg-gray-900/50 hover:border-blue-500/50 transition-all group">
                  <div className="flex items-start gap-4">
                    <div className="bg-gray-900 p-3 rounded group-hover:bg-blue-900/20 transition-colors">
                      <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
                      </svg>
                    </div>
                    <div>
                      <h3 className="text-lg font-bold text-white mb-2">Phone</h3>
                      <p className="text-gray-200 group-hover:text-white transition-colors">226 236 1828</p>
                    </div>
                  </div>
                </Card>
              </motion.a>

              {/* Location Card */}
              <motion.div
                initial={{ opacity: 0, x: -20 }}
                whileInView={{ opacity: 1, x: 0 }}
                viewport={{ once: true }}
                transition={{ delay: 0.2 }}
              >
                <Card className="p-6 border-2 border-gray-800 bg-black/50 hover:bg-gray-900/50 hover:border-blue-500/50 transition-all group">
                  <div className="flex items-start gap-4">
                    <div className="bg-gray-900 p-3 rounded group-hover:bg-blue-900/20 transition-colors">
                      <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                      </svg>
                    </div>
                    <div>
                      <h3 className="text-lg font-bold text-white mb-2">Location</h3>
                      <p className="text-gray-200 group-hover:text-white transition-colors">Calgary, Alberta</p>
                      <p className="text-gray-200 group-hover:text-white transition-colors">Canada</p>
                    </div>
                  </div>
                </Card>
              </motion.div>
            </div>

            {/* Right Column - CTA */}
            <motion.div
              initial={{ opacity: 0, x: 20 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true }}
              className="bg-gradient-to-br from-gray-900 to-black text-white p-8 md:p-10 rounded-2xl border border-gray-800 shadow-2xl relative overflow-hidden"
            >
              {/* Subtle blue glow for the CTA card */}
              <div className="absolute top-0 right-0 w-64 h-64 bg-blue-500/10 blur-[80px] rounded-full pointer-events-none" />

              <h2 className="text-3xl md:text-4xl font-bold mb-6 relative z-10">Ready to Grow Together?</h2>
              <p className="text-gray-300 mb-8 leading-relaxed relative z-10">
                We're selective about our partnerships because we're committed to delivering exceptional results. If you're ready to invest in your brand's growth with a dedicated partner, let's talk.
              </p>

              <ul className="space-y-4 mb-8 relative z-10">
                <li className="flex items-start gap-3">
                  <span className="text-blue-500 mt-1">•</span>
                  <div>
                    <span className="font-bold text-white">Free Strategy Session:</span>
                    <span className="text-gray-300"> Discuss your goals and challenges with our team</span>
                  </div>
                </li>
                <li className="flex items-start gap-3">
                  <span className="text-blue-500 mt-1">•</span>
                  <div>
                    <span className="font-bold text-white">Custom Proposals:</span>
                    <span className="text-gray-300"> Tailored strategies and transparent pricing</span>
                  </div>
                </li>
                <li className="flex items-start gap-3">
                  <span className="text-blue-500 mt-1">•</span>
                  <div>
                    <span className="font-bold text-white">Retainer Programs:</span>
                    <span className="text-gray-300"> Flexible partnership models built for long-term success</span>
                  </div>
                </li>
              </ul>

              <div className="flex flex-col sm:flex-row gap-4 relative z-10">
                <Button
                  variant="outline"
                  size="lg"
                  className="flex-1 border-gray-700 text-white hover:bg-white hover:text-black transition-colors"
                  onClick={() => setIsContactModalOpen(true)}
                >
                  Get in Touch
                </Button>
                <Button
                  size="lg"
                  className="flex-1 bg-white text-black hover:bg-gray-200 transition-colors"
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
