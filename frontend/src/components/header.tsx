'use client'
import { motion } from 'framer-motion'
import { Menu, X } from 'lucide-react'
import React from 'react'
import { Link } from 'react-router-dom'
import { Logo } from './logo'
import { Button } from './ui/button'

const menuItems = [
    { name: 'Features', href: '#link' },
    { name: 'Solution', href: '#link' },
    { name: 'Pricing', href: '#link' },
    { name: 'About', href: '#link' },
]

// Animation variants
const headerVariants = {
    initial: { y: -100, opacity: 0 },
    animate: { 
        y: 0, 
        opacity: 1,
        transition: {
            duration: 0.6,
            ease: [0.0, 0.0, 0.2, 1.0] as const,
            staggerChildren: 0.1,
        }
    }
}

const itemVariants = {
    initial: { opacity: 0, y: -20 },
    animate: { 
        opacity: 1, 
        y: 0,
        transition: {
            duration: 0.4,
            ease: [0.0, 0.0, 0.2, 1.0] as const
        }
    }
}

export const HeroHeader = () => {
    const [menuState, setMenuState] = React.useState(false)
    return (
        <header>
            <motion.nav
                className="bg-transparent fixed z-20 w-full border-b border-white/10 backdrop-blur-xl"
                variants={headerVariants}
                initial="initial"
                animate="animate">
                <div className="mx-auto max-w-6xl px-6 transition-all duration-300">
                    <div className="relative flex flex-wrap items-center justify-between gap-6 py-3 lg:gap-0 lg:py-4">
                        <div className="flex w-full items-center justify-between gap-12 lg:w-auto">
                            <motion.div variants={itemVariants}>
                                <Link
                                    to="/"
                                    aria-label="home"
                                    className="flex items-center space-x-2">
                                    <Logo />
                                </Link>
                            </motion.div>

                            <button
                                onClick={() => setMenuState(!menuState)}
                                aria-label={menuState == true ? 'Close Menu' : 'Open Menu'}
                                data-state={menuState && 'active'}
                                className="relative z-20 -m-2.5 -mr-4 block cursor-pointer p-2.5 lg:hidden">
                                <Menu className="data-[state=active]:rotate-180 data-[state=active]:scale-0 data-[state=active]:opacity-0 m-auto size-6 transition-all duration-200" />
                                <X className="data-[state=active]:rotate-0 data-[state=active]:scale-100 data-[state=active]:opacity-100 absolute inset-0 m-auto size-6 -rotate-180 scale-0 opacity-0 transition-all duration-200" />
                            </button>

                            <motion.div className="hidden lg:block" variants={itemVariants}>
                                <ul className="flex gap-8 text-sm">
                                    {menuItems.map((item, index) => (
                                        <motion.li 
                                            key={index}
                                            initial={{ opacity: 0, y: -10 }}
                                            animate={{ opacity: 1, y: 0 }}
                                            transition={{ 
                                                duration: 0.4, 
                                                ease: [0.0, 0.0, 0.2, 1.0] as const,
                                                delay: 0.2 + (index * 0.1)
                                            }}>
                                            <Link
                                                to={item.href}
                                                className="text-muted-foreground hover:text-accent-foreground block duration-150">
                                                <span>{item.name}</span>
                                            </Link>
                                        </motion.li>
                                    ))}
                                </ul>
                            </motion.div>
                        </div>

                        <motion.div 
                            data-state={menuState && 'active'}
                            className="bg-background data-[state=active]:block lg:data-[state=active]:flex mb-6 hidden w-full flex-wrap items-center justify-end space-y-8 rounded-3xl border p-6 shadow-2xl shadow-zinc-300/20 md:flex-nowrap lg:m-0 lg:flex lg:w-fit lg:gap-6 lg:space-y-0 lg:border-transparent lg:bg-transparent lg:p-0 lg:shadow-none dark:shadow-none dark:lg:bg-transparent"
                            variants={itemVariants}>
                            {/* Mobile menu with text links */}
                            <div className="lg:hidden">
                                <ul className="space-y-6 text-base">
                                    {menuItems.map((item, index) => (
                                        <li key={index}>
                                            <Link
                                                to={item.href}
                                                className="text-muted-foreground hover:text-accent-foreground block duration-150">
                                                <span>{item.name}</span>
                                            </Link>
                                        </li>
                                    ))}
                                    <li>
                                        <Link
                                            to="/login"
                                            className="text-muted-foreground hover:text-accent-foreground block duration-150">
                                            <span>Login</span>
                                        </Link>
                                    </li>
                                    <li>
                                        <Link
                                            to="/signup"
                                            className="text-muted-foreground hover:text-accent-foreground block duration-150">
                                            <span>Sign Up</span>
                                        </Link>
                                    </li>
                                </ul>
                            </div>
                            {/* Desktop buttons */}
                            <div className="hidden lg:flex lg:gap-3">
                                <motion.div
                                    initial={{ opacity: 0, x: -10 }}
                                    animate={{ opacity: 1, x: 0 }}
                                    transition={{ duration: 0.4, ease: [0.0, 0.0, 0.2, 1.0] as const, delay: 0.6 }}>
                                    <Button
                                        asChild
                                        variant="outline"
                                        size="sm">
                                        <Link to="/login">
                                            <span>Login</span>
                                        </Link>
                                    </Button>
                                </motion.div>
                                <motion.div
                                    initial={{ opacity: 0, x: -10 }}
                                    animate={{ opacity: 1, x: 0 }}
                                    transition={{ duration: 0.4, ease: [0.0, 0.0, 0.2, 1.0] as const, delay: 0.7 }}>
                                    <Button
                                        asChild
                                        size="sm">
                                        <Link to="/signup">
                                            <span>Sign Up</span>
                                        </Link>
                                    </Button>
                                </motion.div>
                            </div>
                        </motion.div>
                    </div>
                </div>
            </motion.nav>
        </header>
    )
}