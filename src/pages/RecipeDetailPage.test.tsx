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
  useAuth: () => ({ isSignedIn: true, isLoaded: true, getToken: vi.fn().mockResolvedValue("test-token") }),
  SignedIn: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

// Global Mocks for navigator
const mockNavigatorShare = vi.fn();
const mockNavigatorClipboardWriteText = vi.fn();

beforeAll(() => {
  // @ts-expect-error - Mocking global navigator.share for testing
  global.navigator.share = mockNavigatorShare;
  // @ts-expect-error - Mocking global navigator.clipboard for testing
  global.navigator.clipboard = { writeText: mockNavigatorClipboardWriteText };
});

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(reactRouter.useParams).mockReturnValue({ recipeId: "1" });
  vi.mocked(recipeApi.getById).mockResolvedValue(sampleRecipe);
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
    // @ts-expect-error - Temporarily disabling navigator.share for fallback testing
    global.navigator.share = undefined;
    mockNavigatorClipboardWriteText.mockResolvedValueOnce(undefined);

    const shareButton = await renderComponentAndWaitForRecipe();
    fireEvent.click(shareButton);

    await waitFor(() => {
      expect(mockNavigatorClipboardWriteText).toHaveBeenCalledTimes(1);
      expect(mockNavigatorClipboardWriteText).toHaveBeenCalledWith(window.location.href);
      expect(screen.getByText("Copied!")).toBeInTheDocument();
    });
    // @ts-expect-error - Restoring mocked navigator.share after test
    global.navigator.share = mockNavigatorShare;
  });

  test("should show 'Failed to copy' if clipboard.writeText fails and navigator.share is undefined", async () => {
    // @ts-expect-error - Temporarily disabling navigator.share for fallback testing
    global.navigator.share = undefined;
    mockNavigatorClipboardWriteText.mockRejectedValueOnce(new Error("Copy failed"));

    const shareButton = await renderComponentAndWaitForRecipe();
    fireEvent.click(shareButton);

    await waitFor(() => {
      expect(mockNavigatorClipboardWriteText).toHaveBeenCalledTimes(1);
      expect(screen.getByText("Failed to copy")).toBeInTheDocument();
    });
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
