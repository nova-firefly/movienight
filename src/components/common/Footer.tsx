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
        py: 2,
        textAlign: "center",
        borderTop: "1px solid",
        borderColor: "divider",
      }}
    >
      <Typography level="body-xs">
        &copy; {year} MovieNight. All rights reserved.
      </Typography>
      {(GIT_BRANCH || GIT_HASH) && (
        <Typography level="body-xs" sx={{ color: "neutral.400", mt: 0.5 }}>
          {GIT_BRANCH && <>branch: {GIT_BRANCH}</>}
          {GIT_BRANCH && GIT_HASH && " · "}
          {GIT_HASH && <>commit: {GIT_HASH.slice(0, 7)}</>}
        </Typography>
      )}
    </Box>
  );
};
