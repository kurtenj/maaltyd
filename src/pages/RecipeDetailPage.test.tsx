import React from "react";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import "@testing-library/jest-dom";
import RecipeDetailPage from "./RecipeDetailPage";
import { Recipe } from "../types/recipe";
import { logger } from "../utils/logger";

// Mocks
jest.mock("react-router-dom", () => ({
  ...jest.requireActual("react-router-dom"),
  useParams: jest.fn(),
  useNavigate: jest.fn(() => jest.fn()), // Mock navigate function
  Link: jest.fn(({ children }) => <a href="#">{children}</a>), // Simple Link mock
}));

jest.mock("../hooks/useRecipes", () => ({
  useRecipes: jest.fn(() => ({
    refetchRecipes: jest.fn(),
  })),
}));

jest.mock("../services/api", () => ({
  recipeApi: {
    getById: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
  },
}));

jest.mock("../utils/logger", () => ({
  logger: {
    info: jest.fn(),
    error: jest.fn(),
    warn: jest.fn(),
  },
}));

// Global Mocks for navigator and window.alert
const mockNavigatorShare = jest.fn();
const mockNavigatorClipboardWriteText = jest.fn();
const mockWindowAlert = jest.fn();

beforeAll(() => {
  // @ts-ignore
  global.navigator.share = mockNavigatorShare;
  // @ts-ignore
  global.navigator.clipboard = { writeText: mockNavigatorClipboardWriteText };
  global.window.alert = mockWindowAlert;
});

beforeEach(() => {
  // Clear mocks before each test
  jest.clearAllMocks();
  (jest.requireMock("react-router-dom") as { useParams: jest.Mock }).useParams.mockReturnValue({ recipeId: "1" });
  (jest.requireMock("../services/api") as { recipeApi: { getById: jest.Mock } }).recipeApi.getById.mockResolvedValue(sampleRecipe);
});

const sampleRecipe: Recipe = {
  id: "1",
  title: "Test Recipe",
  instructions: ["Step 1", "Step 2"],
  other: [
    { name: "Ingredient 1", quantity: "1", unit: "cup" },
    { name: "Ingredient 2", quantity: "200", unit: "grams" },
    { name: "Ingredient 3", quantity: "A pinch" }, // No unit
    { name: "Ingredient 4", unit: "ml" }, // No quantity
    { name: "Ingredient 5" }, // No quantity or unit
  ],
  imageUrl: "test.jpg",
  sourceUrl: "test.com",
  notes: "Test notes",
  tags: ["test", "recipe"],
  isFavorite: false,
  createdAt: "2024-01-01T00:00:00.000Z",
  updatedAt: "2024-01-01T00:00:00.000Z",
};

const expectedFormattedText = `Recipe: Test Recipe

Ingredients:
- 1 cup Ingredient 1
- 200 grams Ingredient 2
- A pinch Ingredient 3
- ml Ingredient 4
- Ingredient 5

Instructions:
1. Step 1
2. Step 2`;

describe("RecipeDetailPage - Sharing Functionality", () => {
  test("should call navigator.share with correct data when available", async () => {
    mockNavigatorShare.mockResolvedValueOnce(undefined); // Simulate successful share
    const shareButton = await renderComponentAndWaitForRecipe();

    fireEvent.click(shareButton);

    await waitFor(() => {
      expect(mockNavigatorShare).toHaveBeenCalledTimes(1);
      expect(mockNavigatorShare).toHaveBeenCalledWith({
        title: sampleRecipe.title,
        text: expectedFormattedText,
      });
    });
    expect(logger.info).toHaveBeenCalledWith(
      "RecipeDetailPage",
      "Recipe shared successfully via Web Share API."
    );
    expect(mockWindowAlert).not.toHaveBeenCalled();
  });

  test("should handle navigator.share rejection (e.g., user cancellation)", async () => {
    const shareError = new Error("Share cancelled");
    mockNavigatorShare.mockRejectedValueOnce(shareError);
    const shareButton = await renderComponentAndWaitForRecipe();

    fireEvent.click(shareButton);

    await waitFor(() => {
      expect(mockNavigatorShare).toHaveBeenCalledTimes(1);
      expect(logger.error).toHaveBeenCalledWith(
        "RecipeDetailPage",
        "Error sharing recipe via Web Share API:",
        shareError
      );
    });
    expect(mockWindowAlert).not.toHaveBeenCalled(); // No alert on share cancellation/error
  });

  test("should use clipboard.writeText and alert success if navigator.share is undefined", async () => {
    // @ts-ignore
    global.navigator.share = undefined; // Simulate navigator.share not being available
    mockNavigatorClipboardWriteText.mockResolvedValueOnce(undefined); // Simulate successful copy

    const shareButton = await renderComponentAndWaitForRecipe();
    fireEvent.click(shareButton);

    await waitFor(() => {
      expect(mockNavigatorClipboardWriteText).toHaveBeenCalledTimes(1);
      expect(mockNavigatorClipboardWriteText).toHaveBeenCalledWith(expectedFormattedText);
      expect(logger.info).toHaveBeenCalledWith(
        "RecipeDetailPage",
        "Recipe copied to clipboard."
      );
      expect(mockWindowAlert).toHaveBeenCalledWith("Recipe copied to clipboard!");
    });
    // Restore navigator.share for other tests
    // @ts-ignore
    global.navigator.share = mockNavigatorShare;
  });

  test("should alert error if clipboard.writeText fails and navigator.share is undefined", async () => {
    // @ts-ignore
    global.navigator.share = undefined; // Simulate navigator.share not being available
    const copyError = new Error("Copy failed");
    mockNavigatorClipboardWriteText.mockRejectedValueOnce(copyError); // Simulate failed copy

    const shareButton = await renderComponentAndWaitForRecipe();
    fireEvent.click(shareButton);

    await waitFor(() => {
      expect(mockNavigatorClipboardWriteText).toHaveBeenCalledTimes(1);
      expect(mockNavigatorClipboardWriteText).toHaveBeenCalledWith(expectedFormattedText);
      expect(logger.error).toHaveBeenCalledWith(
        "RecipeDetailPage",
        "Error copying recipe to clipboard:",
        copyError
      );
      expect(mockWindowAlert).toHaveBeenCalledWith("Could not copy recipe to clipboard.");
    });
    // Restore navigator.share for other tests
    // @ts-ignore
    global.navigator.share = mockNavigatorShare;
  });

  test("should alert and log error if share is attempted when recipe data is null", async () => {
    // Override the getById mock for this specific test
    (jest.requireMock("../services/api") as { recipeApi: { getById: jest.Mock } }).recipeApi.getById.mockResolvedValueOnce(null);

    render(<RecipeDetailPage />);
    // Wait for an element that indicates loading is done but recipe is not found (e.g., the error message div)
    await screen.findByText(/Recipe not found!/i);

    // Attempt to find the share button. It might not be rendered if recipe is null,
    // or it might be there but disabled, or clicking it should do nothing / error out.
    // For this test, we assume the button might still be there, or the test is about the function guard.
    // We will call the share function directly or ensure the button click leads to the expected alert.
    // Since the button is outside the conditional rendering of `if (recipe)`, we can find it.
    const shareButton = screen.queryByRole("button", { name: /Share/i });
    
    // If the design hides the button when there's no recipe, this test needs adjustment.
    // Assuming the button is present and the check is inside handleShare:
    if (shareButton) {
        fireEvent.click(shareButton);
    } else {
        // This case implies the button is not rendered, which itself is a valid state.
        // However, the current implementation of RecipeDetailPage always renders the button bar.
        // The test for the handleShare guard is still valuable.
        // If the button is not found, we can't simulate a click.
        // This part of the test might need to be re-evaluated based on component structure
        // if the button bar itself is conditionally rendered based on `recipe` being null.
        // For now, let's assume the button is always there and the guard in `handleShare` is hit.
        console.warn("Share button not found. The test for 'recipe data is null' might not be fully effective if the button is conditionally rendered.");
    }
    // Directly checking the alert and log because the button click might not be possible if recipe is null
    // and the button is conditionally rendered.
    // However, the current component structure *does* render the button container.
    // The `handleShare` function has a guard for `!recipe`.

    // We need to wait for the alert to be called.
    // Since the button click might not happen if recipe is null (depending on how error state is handled for rendering buttons),
    // this test focuses on the state where `recipe` is null when `handleShare` is invoked.
    // The component initializes with recipe as null, then fetches. If fetch returns null, recipe remains null.
    
    // Re-rendering with getById returning null and then clicking the button.
    // The `renderComponentAndWaitForRecipe` helper expects a recipe.
    
    // The current logic: Button bar is shown even if recipe is null.
    // The click handler `handleShare` has `if (!recipe)` check.
    
    // So, find the button and click it.
    const buttonWhenRecipeIsNull = screen.getByRole("button", { name: /Share/i });
    fireEvent.click(buttonWhenRecipeIsNull);


    await waitFor(() => {
      expect(logger.error).toHaveBeenCalledWith(
        "RecipeDetailPage",
        "Share attempt failed: Recipe data not available."
      );
      expect(mockWindowAlert).toHaveBeenCalledWith("Cannot share recipe: Recipe data is missing.");
    });
  });
});

// Helper to render the component and wait for recipe loading
async function renderComponentAndWaitForRecipe() {
  render(<RecipeDetailPage />);
  // Wait for the recipe details to load and the title to be displayed
  await screen.findByRole("heading", { name: sampleRecipe.title, level: 1 });
  // Wait for the share button to be present
  return screen.findByRole("button", { name: /Share/i });
}
// Remove the placeholder test
