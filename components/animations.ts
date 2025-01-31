import { Variants } from "framer-motion";

export const buttonHoverVariants: Variants = {
  initial: {
    scale: 1,
    transition: { duration: 0.2 }
  },
  hover: {
    scale: 1.05,
    transition: { duration: 0.2 }
  },
  tap: {
    scale: 0.95,
    transition: { duration: 0.1 }
  },
  disabled: {
    opacity: 0.5,
    scale: 1,
    transition: { duration: 0.2 }
  }
};

export const panelVariants: Variants = {
  hidden: {
    opacity: 0,
    y: -20,
    transition: { duration: 0.3 }
  },
  visible: {
    opacity: 1,
    y: 0,
    transition: {
      duration: 0.3,
      type: "spring",
      stiffness: 300,
      damping: 25
    }
  },
  exit: {
    opacity: 0,
    y: -20,
    transition: { duration: 0.2 }
  }
};

export const scaleVariants: Variants = {
  initial: {
    scale: 0,
    opacity: 0
  },
  animate: {
    scale: 1,
    opacity: 1,
    transition: {
      duration: 0.3,
      ease: "easeOut"
    }
  },
  exit: {
    scale: 0,
    opacity: 0,
    transition: {
      duration: 0.2
    }
  }
};

export const fadeVariants: Variants = {
  hidden: {
    opacity: 0
  },
  visible: {
    opacity: 1,
    transition: {
      duration: 0.3
    }
  },
  exit: {
    opacity: 0,
    transition: {
      duration: 0.2
    }
  }
};

export const activeButtonVariants: Variants = {
  inactive: {
    boxShadow: "none",
    color: "rgba(255, 255, 255, 0.8)",
    transition: { duration: 0.2 }
  },
  active: {
    boxShadow: "0 0 15px rgba(76, 237, 255, 0.4)",
    color: "rgb(76, 237, 255)",
    transition: { duration: 0.2 }
  }
};