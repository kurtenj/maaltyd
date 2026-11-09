import React from "react";
import { describe, test, expect, vi, beforeAll, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor, act } from "@testing-library/react";
import "@testing-library/jest-dom";
import RecipeDetailPage from "./RecipeDetailPage";
import { Recipe } from "../types/recipe";
import { recipeApi } from "../services/api";

// Mocks
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), refresh: vi.fn() }),
}));

vi.mock("../services/api", () => ({
  recipeApi: {
    getById: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
    regenerateImage: vi.fn(),
  },
}));

vi.mock("../utils/logger", () => ({
  logger: {
    info: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
  },
}));

vi.mock("@clerk/nextjs", () => ({
  useAuth: () => ({ isSignedIn: true, isLoaded: true, getToken: vi.fn().mockResolvedValue("test-token") }),
  Show: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

// Global Mocks for navigator
const mockNavigatorShare = vi.fn();
const mockNavigatorClipboardWriteText = vi.fn();

const mutableNavigator = global.navigator as unknown as {
  share?: typeof mockNavigatorShare;
  clipboard: { writeText: typeof mockNavigatorClipboardWriteText };
};

beforeAll(() => {
  mutableNavigator.share = mockNavigatorShare;
  Object.defineProperty(global.navigator, "clipboard", {
    value: { writeText: mockNavigatorClipboardWriteText },
    configurable: true,
  });
});

beforeEach(() => {
  vi.clearAllMocks();
});

const sampleRecipe: Recipe = {
  id: "1",
  title: "Test Recipe",
  main: "chicken",
  instructions: ["Step 1", "Step 2"],
  other: [
    { name: "Ingredient 1", quantity: 1, unit: "cup" },
    { name: "Ingredient 2", quantity: 200, unit: "g" },
    { name: "Ingredient 3", quantity: 1, unit: "pinch" }, // quantity + unit
    { name: "Ingredient 4", quantity: 0, unit: "ml" }, // zero quantity (renders as "")
    { name: "Ingredient 5", quantity: 0 }, // no unit
  ],
  imageUrl: "test.jpg",
};

describe("RecipeDetailPage - Sharing Functionality", () => {
  test("should call navigator.share with title and url when available", async () => {
    mockNavigatorShare.mockResolvedValueOnce(undefined);
    const shareButton = await renderComponentAndWaitForRecipe();

    fireEvent.click(shareButton);

    await waitFor(() => {
      expect(mockNavigatorShare).toHaveBeenCalledTimes(1);
      expect(mockNavigatorShare).toHaveBeenCalledWith({
        title: sampleRecipe.title,
        url: window.location.href,
      });
    });
  });

  test("should show check icon after successful native share", async () => {
    mockNavigatorShare.mockResolvedValueOnce(undefined);
    await renderComponentAndWaitForRecipe();

    fireEvent.click(screen.getByTitle(/Share recipe/i));

    await waitFor(() => {
      expect(screen.getByTitle(/Share recipe/i).querySelector("svg")).toBeTruthy();
    });
  });

  test("should handle navigator.share rejection (e.g., user cancellation) silently", async () => {
    mockNavigatorShare.mockRejectedValueOnce(new Error("Share cancelled"));
    const shareButton = await renderComponentAndWaitForRecipe();

    fireEvent.click(shareButton);

    await waitFor(() => {
      expect(mockNavigatorShare).toHaveBeenCalledTimes(1);
    });
    expect(screen.queryByText(/Copied!/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/Failed/i)).not.toBeInTheDocument();
  });

  test("should copy url to clipboard and show 'Copied!' when navigator.share is undefined", async () => {
    mutableNavigator.share = undefined;
    mockNavigatorClipboardWriteText.mockResolvedValueOnce(undefined);

    const shareButton = await renderComponentAndWaitForRecipe();
    fireEvent.click(shareButton);

    await waitFor(() => {
      expect(mockNavigatorClipboardWriteText).toHaveBeenCalledTimes(1);
      expect(mockNavigatorClipboardWriteText).toHaveBeenCalledWith(window.location.href);
      expect(screen.getByText("Copied!")).toBeInTheDocument();
    });
    mutableNavigator.share = mockNavigatorShare;
  });

  test("should show 'Failed to copy' if clipboard.writeText fails and navigator.share is undefined", async () => {
    mutableNavigator.share = undefined;
    mockNavigatorClipboardWriteText.mockRejectedValueOnce(new Error("Copy failed"));

    const shareButton = await renderComponentAndWaitForRecipe();
    fireEvent.click(shareButton);

    await waitFor(() => {
      expect(mockNavigatorClipboardWriteText).toHaveBeenCalledTimes(1);
      expect(screen.getByText("Failed to copy")).toBeInTheDocument();
    });
    mutableNavigator.share = mockNavigatorShare;
  });
});

describe("RecipeDetailPage - Related Recipes", () => {
  const otherChickenRecipe: Recipe = {
    id: "2",
    title: "Other Chicken Recipe",
    main: "chicken",
    instructions: ["Step 1"],
    other: [],
  };

  test("shows recipes sharing the same main ingredient, excluding the current recipe", async () => {
    render(<RecipeDetailPage initialRecipe={sampleRecipe} relatedRecipes={[otherChickenRecipe]} />);

    expect(screen.getByText("Related Recipes")).toBeInTheDocument();
    expect(screen.getByText("Other Chicken Recipe")).toBeInTheDocument();
  });

  test("does not render the Related Recipes section when there are no matches", async () => {
    await renderComponentAndWaitForRecipe();

    expect(screen.queryByText("Related Recipes")).not.toBeInTheDocument();
  });
});

describe("RecipeDetailPage - Generated photo", () => {
  test("shows a generating state, then swaps in the photo once it's ready", async () => {
    vi.useFakeTimers();
    try {
      const withoutImage = { ...sampleRecipe, imageUrl: undefined };
      vi.mocked(recipeApi.getById)
        .mockResolvedValueOnce(withoutImage)
        .mockResolvedValueOnce({ ...withoutImage, imageUrl: "https://img.example.com/generated.webp" });

      render(<RecipeDetailPage initialRecipe={withoutImage} relatedRecipes={[]} awaitingImage />);
      expect(screen.getByText("Generating photo…")).toBeInTheDocument();

      await act(async () => {
        await vi.advanceTimersByTimeAsync(3000); // first poll: not ready yet
      });
      expect(screen.getByText("Generating photo…")).toBeInTheDocument();

      await act(async () => {
        await vi.advanceTimersByTimeAsync(3000); // second poll: ready
      });
      expect(screen.queryByText("Generating photo…")).not.toBeInTheDocument();
      expect(screen.getByAltText(sampleRecipe.title)).toHaveAttribute("src", "https://img.example.com/generated.webp");
      expect(recipeApi.getById).toHaveBeenCalledTimes(2);
    } finally {
      vi.useRealTimers();
    }
  });

  test("does not poll when the recipe isn't awaiting a photo", async () => {
    vi.useFakeTimers();
    try {
      render(<RecipeDetailPage initialRecipe={sampleRecipe} relatedRecipes={[]} />);
      await act(async () => {
        await vi.advanceTimersByTimeAsync(10000);
      });
      expect(recipeApi.getById).not.toHaveBeenCalled();
    } finally {
      vi.useRealTimers();
    }
  });
});

// Helper to render the component and wait for recipe loading
async function renderComponentAndWaitForRecipe() {
  render(<RecipeDetailPage initialRecipe={sampleRecipe} relatedRecipes={[]} />);
  await screen.findByRole("heading", { name: sampleRecipe.title, level: 1 });
  // Wait for the share button to be present
  return screen.findByTitle(/Share recipe/i);
}

