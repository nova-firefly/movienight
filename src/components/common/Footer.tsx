import React from "react";
import { Box, Typography } from "@mui/joy";

const GIT_BRANCH = process.env.REACT_APP_GIT_BRANCH;
const GIT_HASH = process.env.REACT_APP_GIT_HASH;

export const Footer: React.FC = () => {
  const year = new Date().getFullYear();

  return (
    <Box
      component="footer"
      sx={{
        mt: "auto",
        py: 2.5,
        px: { xs: 2, sm: 3 },
        textAlign: "center",
        borderTop: "1px solid",
        borderColor: "divider",
        bgcolor: "background.surface",
      }}
    >
      <Typography level="body-xs" sx={{ color: "text.tertiary" }}>
        &copy; {year} MovieNight
      </Typography>
      {(GIT_BRANCH || GIT_HASH) && (
        <Typography level="body-xs" sx={{ color: "text.tertiary", mt: 0.25, opacity: 0.5 }}>
          {GIT_BRANCH && <>branch: {GIT_BRANCH}</>}
          {GIT_BRANCH && GIT_HASH && " · "}
          {GIT_HASH && <>commit: {GIT_HASH.slice(0, 7)}</>}
        </Typography>
      )}
    </Box>
  );
};
