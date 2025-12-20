"use client";

import { useState } from "react";
import { Button } from "./button";
import { X } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

interface ContactModalProps {
    isOpen: boolean;
    onClose: () => void;
}

export function ContactModal({ isOpen, onClose }: ContactModalProps) {
    const [formData, setFormData] = useState({
        firstName: "",
        lastName: "",
        email: "",
        company: "",
        message: ""
    });

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        // Handle form submission here
        console.log("Form submitted:", formData);
        // You can add email service integration here
        onClose();
    };

    const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
        setFormData(prev => ({
            ...prev,
            [e.target.name]: e.target.value
        }));
    };

    return (
        <AnimatePresence>
            {isOpen && (
                <>
                    {/* Backdrop */}
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        onClick={onClose}
                        className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50"
                    />

                    {/* Modal */}
                    <div className="fixed inset-0 flex items-center justify-center z-50 p-4">
                        <motion.div
                            initial={{ opacity: 0, scale: 0.95 }}
                            animate={{ opacity: 1, scale: 1 }}
                            exit={{ opacity: 0, scale: 0.95 }}
                            className="bg-white rounded-2xl shadow-2xl max-w-4xl w-full max-h-[90vh] overflow-y-auto"
                        >
                            <div className="grid md:grid-cols-2 gap-0">
                                {/* Left Column - Info */}
                                <div className="bg-black text-white p-8 md:p-10 rounded-l-2xl">
                                    <div className="mb-6">
                                        <div className="inline-block bg-white text-black px-4 py-2 rounded-full text-sm font-bold mb-4">
                                            Partner With Us
                                        </div>
                                    </div>

                                    <h2 className="text-3xl md:text-4xl font-bold mb-4">
                                        Let's create something amazing together!
                                    </h2>

                                    <p className="text-gray-300 mb-8">
                                        Ready to take your brand to the next level? Contact us today to discuss how we can help you reach Alberta's most engaged audience.
                                    </p>

                                    <div className="space-y-6">
                                        <div className="flex items-center gap-3">
                                            <div className="bg-white/10 p-2 rounded">
                                                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                                                </svg>
                                            </div>
                                            <span className="text-gray-200">Calgary, AB</span>
                                        </div>

                                        <div className="flex items-center gap-3">
                                            <div className="bg-white/10 p-2 rounded">
                                                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
                                                </svg>
                                            </div>
                                            <span className="text-gray-200">226 236 1828</span>
                                        </div>

                                        <div className="flex items-center gap-3">
                                            <div className="bg-white/10 p-2 rounded">
                                                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                                                </svg>
                                            </div>
                                            <span className="text-gray-200">culturemedia101@gmail.com</span>
                                        </div>
                                    </div>
                                </div>

                                {/* Right Column - Form */}
                                <div className="p-8 md:p-10 relative">
                                    <button
                                        onClick={onClose}
                                        className="absolute top-4 right-4 p-2 hover:bg-gray-100 rounded-full transition-colors"
                                    >
                                        <X className="w-5 h-5" />
                                    </button>

                                    <h3 className="text-2xl font-bold mb-2">Send us a message</h3>

                                    <form onSubmit={handleSubmit} className="space-y-4 mt-6">
                                        <div className="grid grid-cols-2 gap-4">
                                            <div>
                                                <label htmlFor="firstName" className="block text-sm font-medium text-gray-700 mb-1">
                                                    First name
                                                </label>
                                                <input
                                                    type="text"
                                                    id="firstName"
                                                    name="firstName"
                                                    value={formData.firstName}
                                                    onChange={handleChange}
                                                    placeholder="John"
                                                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-black focus:border-transparent outline-none"
                                                    required
                                                />
                                            </div>
                                            <div>
                                                <label htmlFor="lastName" className="block text-sm font-medium text-gray-700 mb-1">
                                                    Last name
                                                </label>
                                                <input
                                                    type="text"
                                                    id="lastName"
                                                    name="lastName"
                                                    value={formData.lastName}
                                                    onChange={handleChange}
                                                    placeholder="Doe"
                                                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-black focus:border-transparent outline-none"
                                                    required
                                                />
                                            </div>
                                        </div>

                                        <div>
                                            <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-1">
                                                Email
                                            </label>
                                            <input
                                                type="email"
                                                id="email"
                                                name="email"
                                                value={formData.email}
                                                onChange={handleChange}
                                                placeholder="john@company.com"
                                                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-black focus:border-transparent outline-none"
                                                required
                                            />
                                        </div>

                                        <div>
                                            <label htmlFor="company" className="block text-sm font-medium text-gray-700 mb-1">
                                                Company
                                            </label>
                                            <input
                                                type="text"
                                                id="company"
                                                name="company"
                                                value={formData.company}
                                                onChange={handleChange}
                                                placeholder="Your company name"
                                                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-black focus:border-transparent outline-none"
                                            />
                                        </div>

                                        <div>
                                            <label htmlFor="message" className="block text-sm font-medium text-gray-700 mb-1">
                                                Message
                                            </label>
                                            <textarea
                                                id="message"
                                                name="message"
                                                value={formData.message}
                                                onChange={handleChange}
                                                placeholder="Tell us about your brand and what you're looking for..."
                                                rows={4}
                                                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-black focus:border-transparent outline-none resize-none"
                                                required
                                            />
                                        </div>

                                        <Button type="submit" size="lg" className="w-full">
                                            Send Message
                                            <ArrowRight className="ml-2 h-4 w-4" />
                                        </Button>
                                    </form>
                                </div>
                            </div>
                        </motion.div>
                    </div>
                </>
            )}
        </AnimatePresence>
    );
}

function ArrowRight({ className }: { className?: string }) {
    return (
        <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" />
        </svg>
    );
}
