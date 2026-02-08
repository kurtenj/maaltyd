import React from "react";
import { describe, test, expect, vi, beforeAll, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import "@testing-library/jest-dom";
import RecipeDetailPage from "./RecipeDetailPage";
import { Recipe } from "../types/recipe";
import * as reactRouter from "react-router-dom";
import { recipeApi } from "../services/api";

// Mocks
vi.mock("react-router-dom", async (importOriginal) => {
  const actual = await importOriginal<typeof reactRouter>();
  return {
    ...actual,
    useParams: vi.fn(),
    useNavigate: vi.fn(() => vi.fn()),
    Link: ({ children }: { children: React.ReactNode }) => <a href="#">{children}</a>,
  };
});

vi.mock("../hooks/useRecipes", () => ({
  useRecipes: vi.fn(() => ({
    refetchRecipes: vi.fn(),
  })),
}));

vi.mock("../services/api", () => ({
  recipeApi: {
    getById: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
  },
}));

vi.mock("../utils/logger", () => ({
  logger: {
    info: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
  },
}));

vi.mock("@clerk/clerk-react", () => ({
  useAuth: () => ({ userId: "test-user", isLoaded: true }),
  SignedIn: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

// Global Mocks for navigator and window.alert
const mockNavigatorShare = vi.fn();
const mockNavigatorClipboardWriteText = vi.fn();
const mockWindowAlert = vi.fn();

beforeAll(() => {
  // @ts-expect-error - Mocking global navigator.share for testing
  global.navigator.share = mockNavigatorShare;
  // @ts-expect-error - Mocking global navigator.clipboard for testing
  global.navigator.clipboard = { writeText: mockNavigatorClipboardWriteText };
  global.window.alert = mockWindowAlert;
});

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(reactRouter.useParams).mockReturnValue({ recipeId: "1" });
  vi.mocked(recipeApi.getById).mockResolvedValue(sampleRecipe);
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
- A pinch  Ingredient 3
-  ml Ingredient 4
-   Ingredient 5

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
    expect(mockWindowAlert).not.toHaveBeenCalled();
  });

  test("should handle navigator.share rejection (e.g., user cancellation)", async () => {
    const shareError = new Error("Share cancelled");
    mockNavigatorShare.mockRejectedValueOnce(shareError);
    const shareButton = await renderComponentAndWaitForRecipe();

    fireEvent.click(shareButton);

    await waitFor(() => {
      expect(mockNavigatorShare).toHaveBeenCalledTimes(1);
    });
    expect(mockWindowAlert).not.toHaveBeenCalled(); // No alert on share cancellation
  });

  test("should use clipboard.writeText and alert success if navigator.share is undefined", async () => {
    // @ts-expect-error - Temporarily disabling navigator.share for fallback testing
    global.navigator.share = undefined; // Simulate navigator.share not being available
    mockNavigatorClipboardWriteText.mockResolvedValueOnce(undefined); // Simulate successful copy

    const shareButton = await renderComponentAndWaitForRecipe();
    fireEvent.click(shareButton);

    await waitFor(() => {
      expect(mockNavigatorClipboardWriteText).toHaveBeenCalledTimes(1);
      expect(mockNavigatorClipboardWriteText).toHaveBeenCalledWith(expectedFormattedText);
      expect(mockWindowAlert).toHaveBeenCalledWith("Recipe copied to clipboard!");
    });
    // Restore navigator.share for other tests
    // @ts-expect-error - Restoring mocked navigator.share after test
    global.navigator.share = mockNavigatorShare;
  });

  test("should alert error if clipboard.writeText fails and navigator.share is undefined", async () => {
    // @ts-expect-error - Temporarily disabling navigator.share for fallback testing
    global.navigator.share = undefined; // Simulate navigator.share not being available
    mockNavigatorClipboardWriteText.mockRejectedValueOnce(new Error("Copy failed")); // Simulate failed copy

    const shareButton = await renderComponentAndWaitForRecipe();
    fireEvent.click(shareButton);

    await waitFor(() => {
      expect(mockNavigatorClipboardWriteText).toHaveBeenCalledTimes(1);
      expect(mockNavigatorClipboardWriteText).toHaveBeenCalledWith(expectedFormattedText);
      expect(mockWindowAlert).toHaveBeenCalledWith("Could not copy recipe to clipboard.");
    });
    // Restore navigator.share for other tests
    // @ts-expect-error - Restoring mocked navigator.share after test
    global.navigator.share = mockNavigatorShare;
  });

  test("should display error when recipe is not found", async () => {
    // When getById returns null, component shows error state (no Share button rendered)
    vi.mocked(recipeApi.getById).mockResolvedValueOnce(null);

    render(<RecipeDetailPage />);

    await waitFor(() => {
      expect(screen.getByText(/Recipe not found!/i)).toBeInTheDocument();
    });
    // Share button is not rendered when recipe is null - component returns early with error UI
    expect(screen.queryByTitle(/Share recipe/i)).not.toBeInTheDocument();
  });
});

// Helper to render the component and wait for recipe loading
async function renderComponentAndWaitForRecipe() {
  render(<RecipeDetailPage />);
  // Wait for the recipe details to load and the title to be displayed
  await screen.findByRole("heading", { name: sampleRecipe.title, level: 1 });
  // Wait for the share button to be present
  return screen.findByTitle(/Share recipe/i);
}
// Remove the placeholder test
