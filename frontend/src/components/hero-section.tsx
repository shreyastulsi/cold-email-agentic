import { AnimatePresence, motion } from 'framer-motion'
import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { HeroHeader } from "./header"
import { InfiniteSlider } from './infinite-slider'
import { ProgressiveBlur } from './progressive-blur'
import { Button } from './ui/button'
import { Meteors } from './ui/meteors'
import { TypewriterEffectSmooth } from './ui/typewriter-effect'

const fadeInUp = {
    initial: { opacity: 0, y: 20 },
    animate: { opacity: 1, y: 0 },
}

const fadeIn = {
    initial: { opacity: 0 },
    animate: { opacity: 1 },
}

const staggerContainer = {
    animate: {
        transition: {
            staggerChildren: 0.15,
        },
    },
}

const recruiters = [
    {
        name: "Stephanie Juarez",
        company: "Amazon",
        title: "Technical Recruiter",
        image: "https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?q=80&w=200&h=200&fit=crop",
        role1: "Data Scientist",
        role2: "Intelligent Talent"
    },
    {
        name: "Marcus Chen",
        company: "Google",
        title: "Engineering Recruiter",
        image: "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?q=80&w=200&h=200&fit=crop",
        role1: "Machine Learning Engineer",
        role2: "Cloud Architect"
    },
    {
        name: "Sarah Williams",
        company: "Microsoft",
        title: "Senior Talent Acquisition",
        image: "https://images.unsplash.com/photo-1494790108377-be9c29b29330?q=80&w=200&h=200&fit=crop",
        role1: "Software Engineer",
        role2: "AI Researcher"
    }
]

export default function HeroSection() {
    const [currentRecruiterIndex, setCurrentRecruiterIndex] = useState(0)
    const [key, setKey] = useState(0)

    useEffect(() => {
        const interval = setInterval(() => {
            setCurrentRecruiterIndex((prev) => (prev + 1) % recruiters.length)
            setKey((prev) => prev + 1)
        }, 10000)
        return () => clearInterval(interval)
    }, [])

    const currentRecruiter = recruiters[currentRecruiterIndex]

    const words = [
        { text: "Hi", className: "text-gray-200" },
        { text: `${currentRecruiter.name.split(' ')[0]},`, className: "text-gray-200" },
        { text: "I", className: "text-gray-200" },
        { text: "came", className: "text-gray-200" },
        { text: "across", className: "text-gray-200" },
        { text: currentRecruiter.company, className: "text-blue-400 font-semibold" },
        { text: "and", className: "text-gray-200" },
        { text: "was", className: "text-gray-200" },
        { text: "really", className: "text-gray-200" },
        { text: "impressed", className: "text-gray-200" },
        { text: "by", className: "text-gray-200" },
        { text: "your", className: "text-gray-200" },
        { text: "team's", className: "text-gray-200" },
        { text: "focus", className: "text-gray-200" },
        { text: "on", className: "text-gray-200" },
        { text: "intelligent", className: "text-gray-200" },
        { text: "hiring", className: "text-gray-200" },
        { text: "technology.", className: "text-gray-200" },
        { text: "I'd", className: "text-gray-200" },
        { text: "love", className: "text-gray-200" },
        { text: "to", className: "text-gray-200" },
        { text: "connect", className: "text-gray-200" },
        { text: "and", className: "text-gray-200" },
        { text: "learn", className: "text-gray-200" },
        { text: "more", className: "text-gray-200" },
        { text: "about", className: "text-gray-200" },
        ...currentRecruiter.role1.split(' ').map((word) => ({
            text: word,
            className: "text-blue-400 font-semibold"
        })),
        { text: "or", className: "text-gray-200" },
        ...currentRecruiter.role2.split(' ').map((word) => ({
            text: word,
            className: "text-blue-400 font-semibold"
        })),
        { text: "roles", className: "text-gray-200" },
        { text: "given", className: "text-gray-200" },
        { text: "my", className: "text-gray-200" },
        { text: "experience", className: "text-gray-200" },
        { text: "across", className: "text-gray-200" },
        { text: "Python,", className: "text-blue-400 font-semibold" },
        { text: "Java,", className: "text-blue-400 font-semibold" },
        { text: "SQL,", className: "text-blue-400 font-semibold" },
        { text: "and", className: "text-gray-200" },
        { text: "AWS.", className: "text-blue-400 font-semibold" },
    ]

    return (
        <>
            <HeroHeader />
            <main className="min-h-screen overflow-x-hidden bg-gradient-to-br from-gray-900 via-gray to-gray">
                <section className="relative overflow-hidden">
                    <Meteors number={30} />
                    <div className="pb-24 pt-12 md:pb-32 lg:pb-56 lg:pt-44">
                        <div className="relative mx-auto flex max-w-6xl flex-col gap-16 px-6 xl:block xl:gap-0">
                            <motion.div
                                className="mx-auto max-w-lg text-center xl:ml-0 xl:w-1/2 xl:text-left"
                                variants={staggerContainer}
                                initial="initial"
                                animate="animate"
                            >
                                <motion.h1
                                    className="mt-16 text-balance text-5xl font-medium text-white md:mt-8 md:text-6xl xl:mt-16 xl:text-7xl"
                                    variants={fadeInUp}
                                    transition={{ duration: 0.6, ease: [0.0, 0.0, 0.2, 1.0] as const }}
                                >
                                    Connecting You to Your Next Big Opportunity.
                                </motion.h1>
                                <motion.p
                                    className="mt-8 text-pretty text-lg text-gray-300"
                                    variants={fadeInUp}
                                    transition={{ duration: 0.6, ease: [0.0, 0.0, 0.2, 1.0] as const }}
                                >
                                    <span style={{ fontFamily: '"The Seasons", serif', fontWeight: 600 }} className="text-xl font-semibold">keryx</span> is the perfect tool to automatically find and reach out to recruiters, professors, and industry professionals so you can land your next big job, research position, or internship asap
                                </motion.p>
                                <motion.div
                                    className="mt-12 flex flex-col items-center justify-center gap-2 sm:flex-row xl:justify-start"
                                    variants={fadeInUp}
                                    transition={{ duration: 0.6, ease: [0.0, 0.0, 0.2, 1.0] as const }}
                                >
                                    <Button
                                        asChild
                                        size="lg"
                                        className="px-5 text-base">
                                        <Link to="/login">
                                            <span className="text-nowrap">Get Started</span>
                                        </Link>
                                    </Button>
                                </motion.div>
                            </motion.div>

                            <motion.div
                                className="relative mx-auto w-full max-w-md pb-24 xl:absolute xl:right-0 xl:top-8 xl:mx-0 xl:w-[500px] xl:pb-0"
                                initial={{ opacity: 0, scale: 0.95, y: 20 }}
                                animate={{ opacity: 1, scale: 1, y: 0 }}
                                transition={{ duration: 0.8, ease: [0.0, 0.0, 0.2, 1.0] as const, delay: 0.3 }}
                            >
                                <div className="relative bg-gray-800/50 backdrop-blur-sm border border-gray-700/50 rounded-2xl shadow-2xl p-8">
                                    <div className="leading-relaxed">
                                        <TypewriterEffectSmooth
                                            key={key}
                                            words={words}
                                            className="text-left font-normal leading-relaxed text-base"
                                        />
                                    </div>
                                </div>

                                {/* ✅ Updated snippet below */}
                                <AnimatePresence mode="wait">
                                    <div className="flex justify-center items-center mt-6 xl:mt-0 xl:block">
                                        <motion.div
                                            key={currentRecruiterIndex}
                                            className="relative flex items-center gap-3 xl:absolute xl:-bottom-20 xl:-left-16"
                                            initial={{ opacity: 0, y: 10 }}
                                            animate={{ opacity: 1, y: 0 }}
                                            exit={{ opacity: 0, y: -10 }}
                                            transition={{ duration: 0.5, ease: 'easeInOut' }}
                                        >
                                            <div className="w-24 h-24 rounded-full border-4 border-gray-700 shadow-xl overflow-hidden bg-gradient-to-br from-blue-400 to-purple-500 flex-shrink-0">
                                                <img
                                                    src={currentRecruiter.image}
                                                    alt={currentRecruiter.name}
                                                    className="w-full h-full object-cover"
                                                />
                                            </div>
                                            <div className="flex flex-col text-left">
                                                <div className="font-bold text-md text-white whitespace-nowrap">
                                                    <span className="text-sm text-gray-400 whitespace-nowrap">To: </span>
                                                    {currentRecruiter.name}
                                                </div>
                                                <div className="text-sm text-gray-400 whitespace-nowrap">
                                                    {currentRecruiter.title} at {currentRecruiter.company}
                                                </div>
                                            </div>
                                        </motion.div>
                                    </div>
                                </AnimatePresence>
                                {/* ✅ End of modified section */}
                            </motion.div>
                        </div>
                    </div>
                </section>
                <motion.section
                    className="pb-16 md:pb-32"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ duration: 0.6, delay: 0.6 }}
                >
                    <div className="group relative m-auto max-w-6xl px-6">
                        <div className="flex flex-col items-center md:flex-row">
                            <div className="md:max-w-44 md:border-r md:border-gray-700/50 md:pr-6">
                                <p className="text-end text-sm text-gray-400">Helping Place People in All Places</p>
                            </div>
                            <div className="relative py-6 md:w-[calc(100%-11rem)]">
                                <InfiniteSlider speedOnHover={20} speed={40} gap={64}>
                                    <div className="flex shrink-0">
                                        <img className="mx-auto h-5 w-fit invert brightness-0 invert"
                                            src="https://html.tailus.io/blocks/customers/nvidia.svg" alt="Nvidia Logo" />
                                    </div>
                                    <div className="flex shrink-0">
                                        <img className="mx-auto h-4 w-fit invert brightness-0 invert"
                                            src="https://html.tailus.io/blocks/customers/column.svg" alt="Column Logo" />
                                    </div>
                                    <div className="flex shrink-0">
                                        <img className="mx-auto h-4 w-fit invert brightness-0 invert"
                                            src="https://html.tailus.io/blocks/customers/github.svg" alt="GitHub Logo" />
                                    </div>
                                    <div className="flex shrink-0">
                                        <img className="mx-auto h-5 w-fit invert brightness-0 invert"
                                            src="https://html.tailus.io/blocks/customers/nike.svg" alt="Nike Logo" />
                                    </div>
                                    <div className="flex shrink-0">
                                        <img className="mx-auto h-5 w-fit invert brightness-0 invert"
                                            src="https://html.tailus.io/blocks/customers/lemonsqueezy.svg" alt="Lemon Squeezy Logo" />
                                    </div>
                                    <div className="flex shrink-0">
                                        <img className="mx-auto h-4 w-fit invert brightness-0 invert"
                                            src="https://html.tailus.io/blocks/customers/laravel.svg" alt="Laravel Logo" />
                                    </div>
                                    <div className="flex shrink-0">
                                        <img className="mx-auto h-7 w-fit invert brightness-0 invert"
                                            src="https://html.tailus.io/blocks/customers/lilly.svg" alt="Lilly Logo" />
                                    </div>
                                    <div className="flex shrink-0">
                                        <img className="mx-auto h-6 w-fit invert brightness-0 invert"
                                            src="https://html.tailus.io/blocks/customers/openai.svg" alt="OpenAI Logo" />
                                    </div>
                                </InfiniteSlider>
                                <div className="bg-linear-to-r from-background absolute inset-y-0 left-0 w-20"></div>
                                <div className="bg-linear-to-l from-background absolute inset-y-0 right-0 w-20"></div>
                                <ProgressiveBlur className="pointer-events-none absolute left-0 top-0 h-full w-20" direction="left" blurIntensity={1} />
                                <ProgressiveBlur className="pointer-events-none absolute right-0 top-0 h-full w-20" direction="right" blurIntensity={1} />
                            </div>
                        </div>
                    </div>
                </motion.section>
            </main>
        </>
    )
}
