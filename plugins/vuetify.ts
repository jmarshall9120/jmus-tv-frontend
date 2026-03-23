// import this after install '@mdi/font' package
import "@mdi/font/css/materialdesignicons.min.css";
import "vuetify/styles";
import { createVuetify } from "vuetify";

// JMUS brand theme: dark green base, gold accent
export default defineNuxtPlugin((app) => {
  const vuetify = createVuetify({
    ssr: true,
    theme: {
      defaultTheme: "jmus",
      themes: {
        jmus: {
          dark: true,
          colors: {
            primary:        "#0d3a38",
            "on-primary":   "#ffffff",
            secondary:      "#e2c050",
            "on-secondary": "#0b3331",
            background:     "#010909",
            "on-background":"#ffffff",
            surface:        "#11453a",
            "on-surface":   "#ffffff",
            error:          "#cf6679",
            warning:        "#c47c20",
            info:           "#4fc3f7",
            success:        "#81c784",
          }
        }
      }
    }
  });
  app.vueApp.use(vuetify);
});
