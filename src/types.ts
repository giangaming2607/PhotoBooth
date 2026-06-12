export interface AppSettings {
  ui_theme: string;
  btn_position: "center" | "fixed-bottom";
  logo_image: string;
  title_image: string;
  bg_type: "color" | "image";
  bg_color: string;
  bg_image: string;
  title: string;
  title_color: string;
  btn_text: string;
  btn_bg_color: string;
  btn_text_color: string;
  github_token: string;
  github_repo: string;
  netlify_url: string;
  countdown_time: number;
  wa_message: string;
  enable_remote_print: boolean;
}

export interface FrameSlot {
  x: number;
  y: number;
  w: number;
  h: number;
  r: number; // rotation in deg
}

export interface Frame {
  id: string;
  name: string;
  baseWidth: number;
  baseHeight: number;
  bg_data_url: string; // the frame overlay/background
  hiasan_data_url: string; // foreground decorations
  slots: FrameSlot[];
}

export interface Session {
  id: string;
  png_url: string;
  gif_url: string;
  timestamp: number;
  cloud_url?: string;
}

export interface PrintJob {
  id: string;
  session_id: string;
  image_url: string;
  status: "pending" | "completed";
  timestamp: number;
}
