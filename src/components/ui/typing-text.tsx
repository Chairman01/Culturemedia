"use client";

import { useState, useEffect } from "react";

interface TypingTextProps {
    text: string;
    className?: string;
    speed?: number;
}

export function TypingText({ text, className = "", speed = 50 }: TypingTextProps) {
    const [displayedText, setDisplayedText] = useState("");
    const [isComplete, setIsComplete] = useState(false);

    useEffect(() => {
        let currentIndex = 0;

        const typeNextCharacter = () => {
            if (currentIndex < text.length) {
                setDisplayedText(text.substring(0, currentIndex + 1));
                currentIndex++;
            } else {
                setIsComplete(true);
            }
        };

        const timer = setInterval(typeNextCharacter, speed);

        return () => clearInterval(timer);
    }, [text, speed]);

    return (
        <span className={className}>
            {displayedText}
            {!isComplete && <span className="animate-pulse">|</span>}
        </span>
    );
}
