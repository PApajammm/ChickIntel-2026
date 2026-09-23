# ChickIntel Backend and AI Architecture Report

## 1. Overview

ChickIntel is a mobile poultry health monitoring and farm management system. The application combines:

- A React Native and Expo mobile client
- Supabase for authentication, database storage, access control, and server-side functions
- Roboflow for remote image-model inference
- Image preprocessing before AI analysis
- Farm-management workflows for chicken batches, egg batches, inventory, health records, schedules, and reports

The mobile app is responsible for user interaction, camera capture, form validation, and displaying results. Supabase provides the backend services, while Roboflow performs the remote image analysis.

## 2. Backend Architecture

The main backend flow is:

```text
Mobile Application
        |
        | Supabase client queries and function calls
        v
Supabase Authentication and PostgreSQL Database
        |
        | Supabase Edge Functions for AI requests
        v
Roboflow Image Inference Service
        |
        v
Predictions and confidence scores returned to the application
```

ChickIntel does not use a separate custom REST API server. The backend is implemented primarily through Supabase tables, Row Level Security policies, direct database helpers, and Edge Functions.

## 3. Why Supabase Is Used

Supabase is used because it provides the backend services required by the application without requiring the project team to build and maintain a complete server from the beginning.

### 3.1 Database

Supabase PostgreSQL stores the application's structured farm data, including:

- User profiles
- Farms and farm memberships
- Chicken batches
- Egg batches
- Inventory items
- Health journal records
- Scan records
- Schedule tasks
- Breeds, symptoms, medications, vitamins, and other lookup data

Examples of database access are implemented in files such as:

- `utils/supabase-batches.ts`
- `utils/supabase-egg-batches.ts`
- `utils/supabase-health-journal.ts`
- `utils/supabase-inventory.ts`
- `utils/supabase-schedule.ts`

### 3.2 Authentication

Supabase Authentication manages user login sessions. The application uses the authenticated user's identity to load the user's profile, farm memberships, and active farm.

### 3.3 Row Level Security

Row Level Security, or RLS, helps restrict database records by farm ownership or membership. This is important because one farm user should not automatically access another farm's private data.

### 3.4 Edge Functions

Supabase Edge Functions provide a secure server-side location for AI requests. The Roboflow API key is stored as a Supabase secret instead of being placed in the mobile application bundle.

### 3.5 Why Supabase Is Appropriate for This System

Supabase is suitable for ChickIntel because it provides:

- Cloud database access
- Authentication
- Access-control policies
- Server-side functions
- A TypeScript-friendly client library
- A simple integration path for a mobile application
- A backend that can grow as farm records increase

Supabase is not the CNN or image model. It is the backend and secure communication layer around the AI services.

## 4. Image Analysis Pipeline

The general image-analysis process is:

1. The user opens a camera feature.
2. The mobile application captures an image.
3. The image is resized and compressed for inference.
4. The image file is read as Base64 data.
5. The app calls a Supabase Edge Function.
6. The Edge Function sends the image to the configured Roboflow model or workflow.
7. Roboflow analyzes the image and returns class predictions and confidence values.
8. The Edge Function normalizes the response.
9. The mobile application interprets and displays the result.

The image preparation logic is implemented in `utils/image-crop-helper.ts`. The application normally limits the image to approximately 1024 pixels on its longest side to reduce upload size and network delay while preserving useful visual information.

## 5. Why Roboflow Is Used

Roboflow is used as the remote computer-vision platform. It provides the trained model hosting and inference endpoint so the application does not need to package and execute a large model directly on every phone.

Roboflow is useful for this project because it provides:

- Model hosting
- Image inference endpoints
- Model and workflow versioning
- Prediction confidence values
- A practical way to connect trained image models to a mobile application

The Supabase Edge Functions currently connect to these Roboflow services:

- `roboflow-health-inference`
- `roboflow-breed-inference`
- `roboflow-sexing-inference`

## 6. Health Detection

The health camera sends the captured image to `roboflow-health-inference` through Supabase. The Edge Function forwards the Base64 image to the configured Roboflow health model and returns normalized predictions.

The health flow can combine image-based predictions with the application's health rules and symptom information. The health result can then be saved into health logs and scan records.

The health model currently has a configured identifier containing:

```text
donut-ep62e/chickintel-disease-classifier-seug1-4-vit-base-patch16-224-in21k-t1
```

The `vit-base-patch16-224` name indicates a Vision Transformer-style model identifier. It does not provide evidence that the deployed model is a traditional CNN.

## 7. Breed Identification

The breed camera sends the image to `roboflow-breed-inference`. The response may contain multiple predictions. The application:

- Extracts class labels and confidence values
- Removes duplicate labels
- Sorts predictions by confidence
- Applies a minimum usable confidence threshold
- Detects non-chicken classifications
- Maps recognized labels to supported breed attributes

The configured breed model identifier contains:

```text
donut-ep62e/chicken-breed-identifier-3-vit-base-patch16-224-in21k-t1
```

Like the health model identifier, this includes `vit-base-patch16-224`, which indicates a Vision Transformer family rather than confirming a traditional CNN architecture.

## 8. Camera Sexing

The Camera Sexing feature sends the image to `roboflow-sexing-inference`. The Edge Function calls the configured Roboflow sexing workflow and extracts supported labels such as:

- Cock, male, rooster, or cockerel -> male
- Hen, female, or pullet -> female

The current default workflow URL contains:

```text
sexing-chicken-vsexing-chicken-2-vit-base-patch16-224-in21k-t1-logic
```

This is a Vision Transformer-based workflow identifier, not a traditional CNN identifier.

## 9. What CNN Means in the Thesis Context

A Convolutional Neural Network is a deep-learning architecture commonly used for image classification. CNNs learn visual features in stages, for example:

```text
Image
  -> edges and textures
  -> shapes and body features
  -> higher-level visual patterns
  -> class prediction
```

For poultry applications, a CNN can learn patterns related to:

- Disease symptoms
- Skin or foot conditions
- Feather and body characteristics
- Breed appearance
- Other visible chicken features

A CNN-based classifier normally produces a class and a confidence value, such as:

```text
Bumblefoot: 82%
Healthy: 14%
Other: 4%
```

However, the current source code does not define or train a CNN directly. The mobile app calls remotely hosted Roboflow models, and the model identifiers currently visible in the repository are ViT-based. Therefore, the technically accurate description of the current system is:

> ChickIntel uses remotely hosted deep-learning image classification through Roboflow, integrated with the mobile application through Supabase.

The phrase "using CNN" should only be retained in the thesis title if the actual Roboflow health or breed model documentation confirms that the deployed model is CNN-based, or if the project trains and deploys its own CNN model.

## 10. CNN Versus the Current Application

| Area                             | Current implementation        | CNN requirement                        |
| -------------------------------- | ----------------------------- | -------------------------------------- |
| Image capture                    | Implemented in the mobile app | Not specific to CNN                    |
| Image resizing/compression       | Implemented before inference  | Required preprocessing for many models |
| Model execution                  | Remote Roboflow service       | A CNN would run remotely or locally    |
| Backend connection               | Supabase Edge Functions       | Can securely connect to a CNN service  |
| Health classification            | Roboflow image model          | Confirm exact architecture             |
| Breed classification             | Roboflow image model          | Confirm exact architecture             |
| Sex classification               | Current workflow is ViT-based | Not a traditional CNN                  |
| Training code in repository      | Not present                   | Needed for a fully self-developed CNN  |
| Evaluation metrics in repository | Not present                   | Needed to prove CNN performance        |

## 11. Why the Model Is Hosted Remotely

Remote inference avoids placing a large model directly inside the Android application. This provides several practical benefits:

- Smaller application size
- Easier model updates
- Access to stronger server hardware
- Centralized model version management
- Protection of private API credentials
- Less processing load on the user's phone

The main trade-offs are:

- Internet connection is required
- Inference time depends on network speed and server availability
- Roboflow or cloud usage may create operational costs
- The system depends on the deployed remote model configuration

## 12. Model Outputs and Confidence

The models return predictions and confidence values. A confidence value is the model's estimated certainty for one prediction. It is not automatically the same as the model's overall accuracy.

For example:

```text
Prediction: Hen
Confidence: 91%
```

means that the model assigned a high score to the hen class for that image. It does not prove that the model is correct 91 percent of the time across a test dataset.

## 13. Evaluation Metrics Required for the Thesis

The repository does not currently contain a complete evaluation report with exact model accuracy, precision, recall, F1-score, confusion matrix, validation accuracy, test accuracy, false positives, or false negatives.

Those values must come from the Roboflow model evaluation report or from a separate labeled test evaluation.

For a binary classification task:

```text
Accuracy  = (TP + TN) / (TP + TN + FP + FN)
Precision = TP / (TP + FP)
Recall    = TP / (TP + FN)
F1-score  = 2 * (Precision * Recall) / (Precision + Recall)
```

The thesis should report metrics per class and overall. For example:

```text
Class: Bumblefoot
Precision: [value from evaluation]
Recall: [value from evaluation]
F1-score: [value from evaluation]
False positives: [count from confusion matrix]
False negatives: [count from confusion matrix]
```

Exact numbers must not be invented from individual prediction confidence values.

## 14. Security and Data Flow Considerations

The application should keep these responsibilities separate:

- Mobile app: camera access, image preparation, user interface, and result display
- Supabase: authentication, database access, RLS, and protected server-side function calls
- Roboflow: image-model inference

The Roboflow API key should remain in Supabase secrets. It should not be hard-coded in the mobile application or exposed in public client code.

## 15. Current Implementation Summary

Implemented in the current system:

- Supabase authentication and cloud database integration
- Farm-scoped data access through Supabase policies
- Chicken batch, egg batch, inventory, health, schedule, and related backend helpers
- Camera-based image capture
- Image resizing and compression before inference
- Supabase Edge Functions for health, breed, and sex inference
- Roboflow model and workflow integration
- Prediction label and confidence normalization
- Health, breed, and sex result handling in the mobile app
- Loading states during image analysis

Not proven by the current repository:

- That every deployed model is a CNN
- That the mobile application runs a CNN locally
- Exact accuracy, precision, recall, F1-score, or confusion-matrix values
- A complete training pipeline for a project-owned CNN
- Offline CNN inference on the Android device

## 16. Recommended Thesis Statement

The safest technically accurate statement is:

> ChickIntel is a smart poultry health monitoring and farm management system that uses deep-learning-based image classification through remotely hosted Roboflow models, with Supabase providing authentication, data storage, access control, and secure inference integration.

If the Roboflow health or breed model documentation confirms a CNN architecture, the statement may be narrowed to:

> ChickIntel integrates CNN-based image classification for selected poultry image-analysis modules through Supabase and Roboflow.

This wording distinguishes the application, backend, AI service, and model architecture without claiming that the mobile code directly implements a CNN.
